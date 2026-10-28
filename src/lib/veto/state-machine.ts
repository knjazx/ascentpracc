import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { VetoState, VetoStep, TeamRole, PickedMapResult } from './types';
import { VetoType, SideChoice, ScrimFormat, MatchStatus } from '@prisma/client';

export const TURN_DURATION_SEC = 60;

export function generateVetoSteps(
  format: ScrimFormat,
  firstRole: TeamRole,
  totalAvailableMaps: number
): VetoStep[] {
  const secondRole: TeamRole = firstRole === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';
  const steps: VetoStep[] = [];
  let order = 1;

  if (format === 'BO1') {
    // Standard BO1: Ban until 1 map remains, then side choice on decider
    // Total bans needed = totalAvailableMaps - 1
    const bansNeeded = Math.max(0, totalAvailableMaps - 1);
    for (let i = 0; i < bansNeeded; i++) {
      const teamRole = i % 2 === 0 ? firstRole : secondRole;
      steps.push({ order: order++, teamRole, actionType: VetoType.BAN });
    }
    // Last decider side is chosen by the team that banned second
    steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.SIDE });
  } else if (format === 'BO3') {
    // Dynamic competitive BO3:
    // Requires 2 picks and 1 decider = 3 maps.
    // 1. Initial bans (if at least 6 maps available, ban 1 each)
    const initialBans = totalAvailableMaps >= 6 ? 2 : 0;
    if (initialBans === 2) {
      steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.BAN });
      steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.BAN });
    }

    // 2. Picks
    steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.PICK });
    steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.SIDE }); // Opponent picks side

    steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.PICK });
    steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.SIDE }); // Opponent picks side

    // 3. Second ban phase: ban down until exactly 1 decider map remains
    const remainingBans = Math.max(0, totalAvailableMaps - initialBans - 2 - 1);
    let lastBanRole: TeamRole = secondRole;
    for (let i = 0; i < remainingBans; i++) {
      lastBanRole = i % 2 === 0 ? firstRole : secondRole;
      steps.push({ order: order++, teamRole: lastBanRole, actionType: VetoType.BAN });
    }

    // 4. Side choice on decider
    const deciderSideRole: TeamRole = remainingBans > 0
      ? (lastBanRole === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A')
      : secondRole;
    steps.push({ order: order++, teamRole: deciderSideRole, actionType: VetoType.SIDE });
  } else if (format === 'BO2') {
    // BO2 Scrim format: each team picks 1 map, opponent picks starting side
    steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.BAN });
    steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.BAN });

    steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.PICK });
    steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.SIDE });

    steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.PICK });
    steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.SIDE });
  }

  return steps;
}

export async function getVetoState(matchId: string): Promise<VetoState | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      request: true,
      teamA: true,
      teamB: true,
      vetoActions: { orderBy: { order: 'asc' } },
      maps: { orderBy: { order: 'asc' } },
    },
  });

  if (!match) return null;

  // Active maps from DB minus excluded maps
  const activePoolMaps = await prisma.mapPool.findMany({
    where: { active: true },
    select: { map: true },
  });

  const excluded = match.request?.excludedMaps || [];
  const mapPoolList = activePoolMaps.map((m) => m.map).filter((m) => !excluded.includes(m));

  // Determine coinflip winner
  const coinFlipWinnerRole: TeamRole =
    match.coinFlipWinnerId === match.teamBId ? 'TEAM_B' : 'TEAM_A';

  const steps = generateVetoSteps(match.format, coinFlipWinnerRole, mapPoolList.length);

  const bannedMaps: string[] = [];
  const pickedMaps: PickedMapResult[] = [];
  const actions = match.vetoActions.map((a) => {
    const role: TeamRole = a.teamId === match.teamBId ? 'TEAM_B' : 'TEAM_A';
    if (a.type === VetoType.BAN) {
      bannedMaps.push(a.map);
    } else if (a.type === VetoType.PICK || a.type === VetoType.DECIDER) {
      const existing = pickedMaps.find((p) => p.map === a.map);
      if (!existing) {
        pickedMaps.push({
          order: pickedMaps.length + 1,
          map: a.map,
          pickedByRole: role,
          pickedByTeamId: a.teamId || undefined,
        });
      }
    } else if (a.type === VetoType.SIDE && a.side) {
      const target = pickedMaps.find((p) => p.map === a.map) || pickedMaps[pickedMaps.length - 1];
      if (target) {
        // If team choosing side chose CT:
        // if choosing team is Team A -> startSideA = CT
        // if choosing team is Team B -> startSideA = T
        const isTeamA = a.teamId === match.teamAId;
        target.startSideA = isTeamA ? (a.side === SideChoice.CT ? 'CT' : 'T') : a.side === SideChoice.CT ? 'T' : 'CT';
      }
    }

    return {
      id: a.id,
      order: a.order,
      teamRole: role,
      teamId: a.teamId,
      type: a.type,
      map: a.map,
      side: a.side,
      createdAt: a.createdAt.toISOString(),
    };
  });

  const availableMaps = mapPoolList.filter(
    (m) => !bannedMaps.includes(m) && !pickedMaps.some((p) => p.map === m)
  );

  const currentStepIndex = actions.length;
  const isFinished = currentStepIndex >= steps.length || (match.format === 'BO1' && availableMaps.length === 1 && steps[currentStepIndex]?.actionType !== VetoType.SIDE);

  const currentStep = !isFinished ? steps[currentStepIndex] : null;

  // Compute target map for SIDE step
  let currentTargetMap: string | undefined;
  if (currentStep?.actionType === VetoType.SIDE) {
    if (match.format === 'BO1') {
      currentTargetMap = availableMaps[0];
    } else {
      currentTargetMap = pickedMaps[pickedMaps.length - 1]?.map || availableMaps[0];
    }
  }

  // Calculate remaining timer from last action
  const lastActionTime = actions.length > 0
    ? new Date(actions[actions.length - 1].createdAt).getTime()
    : new Date(match.updatedAt).getTime();

  const turnExpiresAt = lastActionTime + TURN_DURATION_SEC * 1000;

  return {
    matchId,
    format: match.format,
    status: match.status === MatchStatus.SCHEDULED ? 'NOT_STARTED' : isFinished ? 'FINISHED' : 'IN_PROGRESS',
    coinFlipWinnerRole,
    coinFlipWinnerId: match.coinFlipWinnerId || match.teamAId,
    currentStepIndex,
    steps,
    availableMaps,
    bannedMaps,
    pickedMaps,
    actions,
    turnExpiresAt,
    turnDurationSec: TURN_DURATION_SEC,
    isFinished,
    currentTurnRole: currentStep?.teamRole || null,
    currentActionType: currentStep?.actionType || null,
    currentTargetMap,
  };
}

export async function startVeto(matchId: string): Promise<VetoState> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) throw new Error('Матч не найден');

  // Coinflip with crypto.randomInt
  const coinFlipWinnerId = crypto.randomInt(0, 2) === 0 ? match.teamAId : match.teamBId;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: MatchStatus.VETO,
      coinFlipWinnerId,
    },
  });

  const state = await getVetoState(matchId);
  return state!;
}

export async function processVetoAction(
  matchId: string,
  userId: string,
  actionData: { map?: string; side?: SideChoice }
): Promise<VetoState> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { managers: true } },
      teamB: { include: { managers: true } },
    },
  });

  if (!match) throw new Error('Матч не найден');

  let state = await getVetoState(matchId);
  if (!state) throw new Error('Состояние вето не инициализировано');

  if (state.isFinished) throw new Error('Вето карт уже завершено');

  const currentStep = state.steps[state.currentStepIndex];
  if (!currentStep) throw new Error('Некорректный шаг вето');

  // Validate user rights for current turn
  const expectedTeamId = currentStep.teamRole === 'TEAM_A' ? match.teamAId : match.teamBId;
  const expectedTeam = currentStep.teamRole === 'TEAM_A' ? match.teamA : match.teamB;
  const isManager = expectedTeam.managers.some((m) => m.userId === userId);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!isManager && user?.role !== 'ADMIN') {
    throw new Error('Сейчас ход команды соперника');
  }

  // Handle Action types
  if (currentStep.actionType === VetoType.BAN || currentStep.actionType === VetoType.PICK) {
    const selectedMap = actionData.map;
    if (!selectedMap || !state.availableMaps.includes(selectedMap)) {
      throw new Error('Выбранная карта недоступна для этого действия');
    }

    await prisma.vetoAction.create({
      data: {
        matchId,
        order: currentStep.order,
        teamId: expectedTeamId,
        type: currentStep.actionType,
        map: selectedMap,
      },
    });
  } else if (currentStep.actionType === VetoType.SIDE) {
    const side = actionData.side;
    if (!side || ![SideChoice.CT, SideChoice.T].includes(side)) {
      throw new Error('Выберите сторону (CT или T)');
    }

    const targetMap = state.currentTargetMap || state.availableMaps[0];

    await prisma.vetoAction.create({
      data: {
        matchId,
        order: currentStep.order,
        teamId: expectedTeamId,
        type: VetoType.SIDE,
        map: targetMap,
        side,
      },
    });
  }

  // Reload state after action
  state = await getVetoState(matchId);
  if (!state) throw new Error('Не удалось обновить состояние вето');

  // Check if Decider map should be finalized automatically in BO1 or BO3
  const currentAvailable = state.availableMaps;
  if (
    (state.format === 'BO1' || state.format === 'BO3') &&
    currentAvailable.length === 1 &&
    !state.pickedMaps.some((p) => p.map === currentAvailable[0])
  ) {
    const deciderMap = currentAvailable[0];
    await prisma.vetoAction.create({
      data: {
        matchId,
        order: state.steps.length - 1, // Before final side choice
        teamId: null,
        type: VetoType.DECIDER,
        map: deciderMap,
      },
    });
    state = (await getVetoState(matchId))!;
  }

  // If veto is finished, create MatchMap records and transition status to LIVE
  if (state.isFinished) {
    await finalizeVeto(matchId, state);
    state = (await getVetoState(matchId))!;
  }

  return state;
}

export async function processVetoTimeout(matchId: string): Promise<VetoState> {
  const state = await getVetoState(matchId);
  if (!state || state.isFinished || !state.currentActionType) {
    return state!;
  }

  const currentStep = state.steps[state.currentStepIndex];
  const expectedTeamId = currentStep.teamRole === 'TEAM_A' ? state.coinFlipWinnerId : state.matchId;

  if (currentStep.actionType === VetoType.BAN || currentStep.actionType === VetoType.PICK) {
    // Pick random available map
    const randomMap = state.availableMaps[crypto.randomInt(0, state.availableMaps.length)];
    await prisma.vetoAction.create({
      data: {
        matchId,
        order: currentStep.order,
        teamId: expectedTeamId,
        type: currentStep.actionType,
        map: randomMap,
      },
    });
  } else if (currentStep.actionType === VetoType.SIDE) {
    const randomSide = crypto.randomInt(0, 2) === 0 ? SideChoice.CT : SideChoice.T;
    const targetMap = state.currentTargetMap || state.availableMaps[0];
    await prisma.vetoAction.create({
      data: {
        matchId,
        order: currentStep.order,
        teamId: expectedTeamId,
        type: VetoType.SIDE,
        map: targetMap,
        side: randomSide,
      },
    });
  }

  const updatedState = (await getVetoState(matchId))!;
  if (updatedState.isFinished) {
    await finalizeVeto(matchId, updatedState);
  }
  return (await getVetoState(matchId))!;
}

async function finalizeVeto(matchId: string, state: VetoState) {
  await prisma.$transaction(async (tx) => {
    // Clear existing MatchMap if any
    await tx.matchMap.deleteMany({ where: { matchId } });

    for (const p of state.pickedMaps) {
      await tx.matchMap.create({
        data: {
          matchId,
          order: p.order,
          map: p.map,
          pickedBy: p.pickedByTeamId || null,
          startSideA: p.startSideA || 'CT',
        },
      });
    }

    await tx.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.LIVE },
    });

    await tx.chatMessage.create({
      data: {
        matchId,
        system: true,
        text: `Вето карт завершено! Матч переведен в статус LIVE. Карты: ${state.pickedMaps
          .map((m) => `${m.map.replace('de_', '')}`)
          .join(', ')}.`,
      },
    });
  });
}

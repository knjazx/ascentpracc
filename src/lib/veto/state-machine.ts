import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { VetoState, VetoStep, TeamRole, PickedMapResult } from './types';
import { VetoType, SideChoice, ScrimFormat, MatchStatus } from '@prisma/client';

export const TURN_DURATION_SEC = 30;

export function generateVetoSteps(
  format: ScrimFormat,
  firstRole: TeamRole,
  totalAvailableMaps: number
): VetoStep[] {
  const secondRole: TeamRole = firstRole === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A';
  const steps: VetoStep[] = [];
  let order = 1;

  if (format === 'BO1') {
    // БО1: бан бан бан бан бан бан десайдер, стороны через ножевой раунд
    // Total bans needed to leave exactly 1 map = Math.max(0, totalAvailableMaps - 1)
    const bansNeeded = Math.max(0, totalAvailableMaps - 1);
    for (let i = 0; i < bansNeeded; i++) {
      const teamRole = i % 2 === 0 ? firstRole : secondRole;
      steps.push({ order: order++, teamRole, actionType: VetoType.BAN });
    }
    // No SIDE step in BO1: sides decided via knife round in-game
  } else if (format === 'BO3') {
    // БО3: пик пик бан бан бан бан десайдер, сторону выбирает противоположная команда от той которая пикнула карту
    // 1. Picks (up to 2, leaving at least 1 for decider)
    const picksPossible = Math.min(2, Math.max(0, totalAvailableMaps - 1));

    if (picksPossible >= 1) {
      steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.PICK });
      steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.SIDE });
    }
    if (picksPossible >= 2) {
      steps.push({ order: order++, teamRole: secondRole, actionType: VetoType.PICK });
      steps.push({ order: order++, teamRole: firstRole, actionType: VetoType.SIDE });
    }

    // 2. Bans: ban down until exactly 1 decider map remains
    const mapsLeftForBans = Math.max(0, totalAvailableMaps - picksPossible);
    const bansNeeded = Math.max(0, mapsLeftForBans - 1);

    for (let i = 0; i < bansNeeded; i++) {
      const teamRole = i % 2 === 0 ? firstRole : secondRole;
      steps.push({ order: order++, teamRole, actionType: VetoType.BAN });
    }
    // Remaining 1 map is automatically Decider (knife round)
  } else if (format === 'BO5') {
    // БО5: бан бан пик пик пик пик десайдер
    // Need 5 maps total (4 picks + 1 decider).
    // Initial bans = Math.max(0, totalAvailableMaps - 5)
    const bansNeeded = Math.max(0, totalAvailableMaps - 5);
    for (let i = 0; i < bansNeeded; i++) {
      const teamRole = i % 2 === 0 ? firstRole : secondRole;
      steps.push({ order: order++, teamRole, actionType: VetoType.BAN });
    }

    // Picks after bans
    const mapsAfterBans = totalAvailableMaps - bansNeeded;
    const picksPossible = Math.min(4, Math.max(0, mapsAfterBans - 1));

    for (let i = 0; i < picksPossible; i++) {
      const pickRole = i % 2 === 0 ? firstRole : secondRole;
      const sideRole = i % 2 === 0 ? secondRole : firstRole;
      steps.push({ order: order++, teamRole: pickRole, actionType: VetoType.PICK });
      steps.push({ order: order++, teamRole: sideRole, actionType: VetoType.SIDE });
    }
    // Remaining 1 map is automatically Decider (knife round)
  } else if (format === 'BO2') {
    // BO2: пик пик, противоположная сторона выбирает сторону
    const bansNeeded = Math.max(0, totalAvailableMaps - 2);
    for (let i = 0; i < bansNeeded; i++) {
      const teamRole = i % 2 === 0 ? firstRole : secondRole;
      steps.push({ order: order++, teamRole, actionType: VetoType.BAN });
    }
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

  // If match maps were preset without veto, return finished preset state
  if (match.maps.length > 0 && match.vetoActions.length === 0) {
    const pickedMaps: PickedMapResult[] = match.maps.map((m) => ({
      order: m.order,
      map: m.map,
      startSideA: (m.startSideA as 'CT' | 'T') || 'CT',
    }));
    return {
      matchId,
      format: match.format,
      status: 'FINISHED',
      coinFlipWinnerRole: 'TEAM_A',
      coinFlipWinnerId: match.teamAId,
      currentStepIndex: 0,
      steps: [],
      availableMaps: [],
      bannedMaps: [],
      pickedMaps,
      actions: [],
      turnExpiresAt: 0,
      turnDurationSec: TURN_DURATION_SEC,
      isFinished: true,
      currentTurnRole: null,
      currentActionType: null,
      isPreset: true,
    };
  }

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

  const stepActions = actions.filter((a) => a.type !== VetoType.DECIDER);
  const currentStepIndex = stepActions.length;
  const isFinished = currentStepIndex >= steps.length || availableMaps.length === 0;

  const currentStep = !isFinished ? steps[currentStepIndex] : null;

  // Compute target map for SIDE step (the map that was just picked)
  let currentTargetMap: string | undefined;
  if (currentStep?.actionType === VetoType.SIDE) {
    currentTargetMap = pickedMaps[pickedMaps.length - 1]?.map || availableMaps[0];
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

  // Clear previous actions if restarting
  await prisma.vetoAction.deleteMany({ where: { matchId } });
  await prisma.matchMap.deleteMany({ where: { matchId } });

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

    await prisma.chatMessage.create({
      data: {
        matchId,
        system: true,
        text:
          currentStep.actionType === VetoType.BAN
            ? `🚫 [${expectedTeam.tag}] забанила ${selectedMap.replace('de_', '')}`
            : `🎯 [${expectedTeam.tag}] выбрала ${selectedMap.replace('de_', '')}`,
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

    await prisma.chatMessage.create({
      data: {
        matchId,
        system: true,
        text: `🛡️ [${expectedTeam.tag}] выбрала сторону ${side} на ${targetMap.replace('de_', '')}`,
      },
    });
  }

  // Reload state after action
  state = await getVetoState(matchId);
  if (!state) throw new Error('Не удалось обновить состояние вето');

  // Check if Decider map should be finalized automatically in BO1, BO3 or BO5
  const currentAvailable = state.availableMaps;
  if (
    (state.format === 'BO1' || state.format === 'BO3' || state.format === 'BO5') &&
    currentAvailable.length === 1 &&
    !state.pickedMaps.some((p) => p.map === currentAvailable[0])
  ) {
    const deciderMap = currentAvailable[0];
    await prisma.vetoAction.create({
      data: {
        matchId,
        order: state.actions.length + 1,
        teamId: null,
        type: VetoType.DECIDER,
        map: deciderMap,
      },
    });

    await prisma.chatMessage.create({
      data: {
        matchId,
        system: true,
        text: `⚔️ Решающая карта (Decider): ${deciderMap.replace('de_', '')}. Стороны через ножевой раунд.`,
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
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });
  if (!match) throw new Error('Матч не найден');

  let state = await getVetoState(matchId);
  if (!state || state.isFinished || !state.currentActionType) {
    return state!;
  }

  const currentStep = state.steps[state.currentStepIndex];
  const expectedTeamId = currentStep.teamRole === 'TEAM_A' ? match.teamAId : match.teamBId;

  if (currentStep.actionType === VetoType.BAN || currentStep.actionType === VetoType.PICK) {
    if (state.availableMaps.length > 0) {
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

      await prisma.chatMessage.create({
        data: {
          matchId,
          system: true,
          text: `⏳ Время на ход истекло! Автоматически ${
            currentStep.actionType === VetoType.BAN ? 'забанена' : 'выбрана'
          } карта ${randomMap.replace('de_', '')}.`,
        },
      });
    }
  } else if (currentStep.actionType === VetoType.SIDE) {
    const randomSide = crypto.randomInt(0, 2) === 0 ? SideChoice.CT : SideChoice.T;
    const targetMap = state.currentTargetMap || state.pickedMaps[state.pickedMaps.length - 1]?.map || state.availableMaps[0];
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

    await prisma.chatMessage.create({
      data: {
        matchId,
        system: true,
        text: `⏳ Время на выбор стороны истекло! Автоматически выбрана сторона ${randomSide}.`,
      },
    });
  }

  let updatedState = (await getVetoState(matchId))!;

  // Check if Decider map should be finalized automatically
  const currentAvailable = updatedState.availableMaps;
  if (
    (updatedState.format === 'BO1' || updatedState.format === 'BO3' || updatedState.format === 'BO5') &&
    currentAvailable.length === 1 &&
    !updatedState.pickedMaps.some((p) => p.map === currentAvailable[0])
  ) {
    const deciderMap = currentAvailable[0];
    await prisma.vetoAction.create({
      data: {
        matchId,
        order: updatedState.actions.length + 1,
        teamId: null,
        type: VetoType.DECIDER,
        map: deciderMap,
      },
    });

    await prisma.chatMessage.create({
      data: {
        matchId,
        system: true,
        text: `⚔️ Решающая карта (Decider): ${deciderMap.replace('de_', '')}. Стороны через ножевой раунд.`,
      },
    });

    updatedState = (await getVetoState(matchId))!;
  }

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

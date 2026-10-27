import prisma from '@/lib/prisma';
import { getVetoState } from '@/lib/veto/state-machine';
import { VetoType, SideChoice, MatchStatus } from '@prisma/client';

export async function processVetoTimeout(data: { matchId: string; stepOrder: number }) {
  const { matchId, stepOrder } = data;

  const state = await getVetoState(matchId);
  if (!state || state.isFinished) return;

  const currentStep = state.steps[state.currentStepIndex];
  if (!currentStep || currentStep.order !== stepOrder) {
    // Step already advanced, nothing to do
    return;
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { teamA: true, teamB: true },
  });

  if (!match) return;

  const expectedTeamId = currentStep.teamRole === 'TEAM_A' ? match.teamAId : match.teamBId;
  const expectedTeam = currentStep.teamRole === 'TEAM_A' ? match.teamA : match.teamB;

  if (currentStep.actionType === VetoType.BAN || currentStep.actionType === VetoType.PICK) {
    if (state.availableMaps.length === 0) return;
    // Auto-pick random available map
    const randomMap = state.availableMaps[Math.floor(Math.random() * state.availableMaps.length)];

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
        text: `⏳ Время на ход команды [${expectedTeam.tag}] истекло. Автоматически выбрана карта ${randomMap} (${currentStep.actionType}).`,
      },
    });
  } else if (currentStep.actionType === VetoType.SIDE) {
    const targetMap = state.currentTargetMap || state.availableMaps[0] || 'mirage';
    const randomSide = Math.random() > 0.5 ? SideChoice.CT : SideChoice.T;

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
        text: `⏳ Время на выбор стороны команды [${expectedTeam.tag}] истекло. Автоматически выбрана сторона ${randomSide}.`,
      },
    });
  }

  // Check if veto is now finished and transition to LIVE
  const updatedState = await getVetoState(matchId);
  if (updatedState && updatedState.isFinished) {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.LIVE },
    });

    // Populate MatchMap table
    const mapsToPlay = updatedState.pickedMaps.length > 0
      ? updatedState.pickedMaps
      : updatedState.availableMaps.map((m, idx) => ({ map: m, order: idx + 1, pickedByTeamId: null }));

    for (let i = 0; i < mapsToPlay.length; i++) {
      const pm = mapsToPlay[i];
      await prisma.matchMap.upsert({
        where: {
          id: `${matchId}-map-${i + 1}`,
        },
        update: {},
        create: {
          id: `${matchId}-map-${i + 1}`,
          matchId,
          order: i + 1,
          map: pm.map,
          pickedBy: pm.pickedByTeamId || null,
        },
      });
    }

    await prisma.chatMessage.create({
      data: {
        matchId,
        system: true,
        text: `🎮 Процесс вето завершен! Карты определены. Матч переходит в статус LIVE.`,
      },
    });
  }

  console.log(`[Worker] Auto-veto action performed for match #${matchId}, step ${stepOrder}.`);
}

import prisma from '@/lib/prisma';
import { MatchStatus } from '@prisma/client';
import { recalculateTeamStats } from '@/lib/stats';
import { notifyMatchConfirmed } from '@/lib/discord';

export async function processScoreAutoConfirmations(): Promise<{ confirmedCount: number }> {
  // Check matches awaiting result for more than 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const awaitingMatches = await prisma.match.findMany({
    where: {
      status: MatchStatus.AWAITING_RESULT,
      updatedAt: { lte: twentyFourHoursAgo },
    },
    include: {
      teamA: { include: { managers: true } },
      teamB: { include: { managers: true } },
      maps: { orderBy: { order: 'asc' } },
    },
  });

  if (awaitingMatches.length === 0) {
    return { confirmedCount: 0 };
  }

  let count = 0;

  for (const match of awaitingMatches) {
    // Check if one team entered scores while the other didn't
    const teamAEntered = match.maps.every(
      (m) => m.scoreA_byA !== null && m.scoreB_byA !== null
    );
    const teamBEntered = match.maps.every(
      (m) => m.scoreA_byB !== null && m.scoreB_byB !== null
    );

    // If both entered and didn't match, it should be DISPUTED, handled by admin
    // If only one entered, we auto-confirm with their submitted score
    if (!teamAEntered && !teamBEntered) {
      continue;
    }

    const source = teamAEntered ? 'TEAM_A' : 'TEAM_B';

    await prisma.$transaction(async (tx) => {
      let teamAWins = 0;
      let teamBWins = 0;

      for (const m of match.maps) {
        const scoreA = source === 'TEAM_A' ? m.scoreA_byA! : m.scoreA_byB!;
        const scoreB = source === 'TEAM_A' ? m.scoreB_byA! : m.scoreB_byB!;

        if (scoreA > scoreB) teamAWins++;
        else if (scoreB > scoreA) teamBWins++;

        await tx.matchMap.update({
          where: { id: m.id },
          data: {
            finalScoreA: scoreA,
            finalScoreB: scoreB,
          },
        });
      }

      let winnerId: string | null = null;
      if (teamAWins > teamBWins) winnerId = match.teamAId;
      else if (teamBWins > teamAWins) winnerId = match.teamBId;

      await tx.match.update({
        where: { id: match.id },
        data: {
          status: MatchStatus.CONFIRMED,
          winnerId,
        },
      });

      await tx.chatMessage.create({
        data: {
          matchId: match.id,
          system: true,
          text: `Результат матча автоматически подтвержден по истечении 24 часов ожидания ответа второй стороны.`,
        },
      });

      // Notify both teams
      const allManagers = [...match.teamA.managers, ...match.teamB.managers];
      for (const m of allManagers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: 'Результат матча подтвержден',
            message: `Матч [${match.teamA.tag}] vs [${match.teamB.tag}] автоматически подтвержден (таймаут 24 ч).`,
            type: 'MATCH_AUTO_CONFIRMED',
            link: `/matches/${match.id}`,
          },
        });
      }
    });

    // Recalculate stats for both teams
    await recalculateTeamStats(match.teamAId);
    await recalculateTeamStats(match.teamBId);

    // Send Discord alert
    const winnerName =
      match.winnerId === match.teamAId
        ? match.teamA.name
        : match.winnerId === match.teamBId
        ? match.teamB.name
        : 'Ничья';

    let totalScoreA = 0;
    let totalScoreB = 0;
    match.maps.forEach((m) => {
      const sA = source === 'TEAM_A' ? m.scoreA_byA! : m.scoreA_byB!;
      const sB = source === 'TEAM_A' ? m.scoreB_byA! : m.scoreB_byB!;
      if (sA > sB) totalScoreA++;
      else if (sB > sA) totalScoreB++;
    });

    await notifyMatchConfirmed({
      teamAName: match.teamA.name,
      teamATag: match.teamA.tag,
      teamBName: match.teamB.name,
      teamBTag: match.teamB.tag,
      format: match.format,
      scoreA: totalScoreA,
      scoreB: totalScoreB,
      winnerName,
      matchId: match.id,
    });

    count++;
  }

  console.log(`[Worker] Auto-confirmed ${count} matches after 24h.`);
  return { confirmedCount: count };
}

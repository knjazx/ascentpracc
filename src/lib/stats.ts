import prisma from '@/lib/prisma';
import { MatchStatus } from '@prisma/client';

export async function recalculateTeamStats(teamId: string): Promise<void> {
  const matches = await prisma.match.findMany({
    where: {
      status: MatchStatus.CONFIRMED,
      OR: [{ teamAId: teamId }, { teamBId: teamId }],
    },
    include: {
      maps: true,
    },
    orderBy: { scheduledAt: 'desc' },
  });

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const formChars: string[] = [];

  const mapStats: Record<string, { played: number; wins: number; losses: number; winRate: number }> = {};
  const h2h: Record<string, { wins: number; losses: number; draws: number }> = {};

  for (const m of matches) {
    const isTeamA = m.teamAId === teamId;
    const opponentId = isTeamA ? m.teamBId : m.teamAId;

    if (!h2h[opponentId]) {
      h2h[opponentId] = { wins: 0, losses: 0, draws: 0 };
    }

    if (m.winnerId === teamId) {
      wins++;
      h2h[opponentId].wins++;
      if (formChars.length < 5) formChars.push('W');
    } else if (m.winnerId === null) {
      draws++;
      h2h[opponentId].draws++;
      if (formChars.length < 5) formChars.push('D');
    } else {
      losses++;
      h2h[opponentId].losses++;
      if (formChars.length < 5) formChars.push('L');
    }

    // Process maps
    for (const map of m.maps) {
      if (map.finalScoreA !== null && map.finalScoreB !== null) {
        if (!mapStats[map.map]) {
          mapStats[map.map] = { played: 0, wins: 0, losses: 0, winRate: 0 };
        }

        const teamScore = isTeamA ? map.finalScoreA : map.finalScoreB;
        const oppScore = isTeamA ? map.finalScoreB : map.finalScoreA;

        mapStats[map.map].played++;
        if (teamScore > oppScore) {
          mapStats[map.map].wins++;
        } else if (oppScore > teamScore) {
          mapStats[map.map].losses++;
        }
      }
    }
  }

  // Calculate win rates
  for (const map of Object.keys(mapStats)) {
    const s = mapStats[map];
    s.winRate = s.played > 0 ? Number((s.wins / s.played).toFixed(3)) : 0;
  }

  const matchesPlayed = matches.length;
  const winRate = wins + losses > 0 ? Number((wins / (wins + losses)).toFixed(3)) : 0;
  const form = formChars.reverse().join(''); // chronological order: oldest to newest of the last 5

  await prisma.teamStats.upsert({
    where: { teamId },
    update: {
      matchesPlayed,
      wins,
      losses,
      draws,
      winRate,
      form,
      mapStats,
      h2h,
    },
    create: {
      teamId,
      matchesPlayed,
      wins,
      losses,
      draws,
      winRate,
      form,
      mapStats,
      h2h,
    },
  });
}

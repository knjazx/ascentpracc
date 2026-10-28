import prisma from '@/lib/prisma';
import { memoryCache } from '@/lib/memory-cache';

export async function prewarmServerCache(): Promise<void> {
  try {
    const now = new Date();

    // 1. Scrims
    const whereScrims = { status: 'OPEN' as const, expiresAt: { gt: now } };
    const [scrimTotal, scrims] = await Promise.all([
      prisma.scrimRequest.count({ where: whereScrims }),
      prisma.scrimRequest.findMany({
        where: whereScrims,
        take: 12,
        include: {
          team: {
            select: {
              id: true,
              name: true,
              tag: true,
              logoUrl: true,
              avgElo: true,
              noShowCount: true,
              stats: { select: { winRate: true, matchesPlayed: true } },
            },
          },
          slots: { where: { startsAt: { gt: now } }, orderBy: { startsAt: 'asc' } },
          _count: { select: { responses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    memoryCache.set('scrims:all:all:all:all::1:12', {
      success: true,
      data: {
        scrims: scrims.map((s) => ({ ...s, responsesCount: s._count.responses })),
        pagination: { total: scrimTotal, page: 1, limit: 12, totalPages: Math.ceil(scrimTotal / 12) },
      },
    }, 60);

    // 2. Teams
    const [teamTotal, teams] = await Promise.all([
      prisma.team.count(),
      prisma.team.findMany({
        take: 24,
        include: {
          stats: true,
          managers: {
            include: {
              user: { select: { id: true, nickname: true, avatarUrl: true, steamId: true } },
            },
          },
          _count: { select: { matchesAsTeamA: true, matchesAsTeamB: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    memoryCache.set('teams::1:24', {
      success: true,
      data: {
        teams: teams.map((team) => ({
          ...team,
          totalMatches: team._count.matchesAsTeamA + team._count.matchesAsTeamB,
        })),
        pagination: { total: teamTotal, page: 1, limit: 24, totalPages: Math.ceil(teamTotal / 24) },
      },
    }, 60);

    // 3. Matches
    const [matchTotal, matches] = await Promise.all([
      prisma.match.count(),
      prisma.match.findMany({
        take: 15,
        orderBy: { scheduledAt: 'desc' },
        include: {
          teamA: { select: { id: true, name: true, tag: true, logoUrl: true, discordInvite: true } },
          teamB: { select: { id: true, name: true, tag: true, logoUrl: true, discordInvite: true } },
          maps: {
            orderBy: { order: 'asc' },
            select: { id: true, order: true, map: true, finalScoreA: true, finalScoreB: true, pickedBy: true },
          },
        },
      }),
    ]);

    memoryCache.set('matches:all:all:all::1:15', {
      success: true,
      data: {
        matches,
        pagination: { page: 1, limit: 15, total: matchTotal, totalPages: Math.ceil(matchTotal / 15) },
      },
    }, 60);

    console.log('[Cache] Server cache pre-warmed successfully.');
  } catch (err) {
    console.warn('[Cache] Could not pre-warm server cache:', err);
  }
}

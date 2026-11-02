import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MatchStatus, ScrimFormat, Prisma } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const teamId = searchParams.get('teamId');
    const myOnly = searchParams.get('myOnly') === 'true';
    const formatParam = searchParams.get('format');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const skip = (page - 1) * limit;

    const currentUser = myOnly ? await getCurrentUser() : null;
    const cacheKey = `matches:${statusParam || 'all'}:${teamId || 'all'}:${formatParam || 'all'}:${search || ''}:${page}:${limit}`;

    if (!myOnly) {
      const cached = memoryCache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const where: Prisma.MatchWhereInput = {};

    if (myOnly) {
      if (!currentUser) {
        return NextResponse.json({
          success: true,
          data: { matches: [], pagination: { total: 0, page, limit, totalPages: 0 } },
        });
      }

      const userManagers = await prisma.teamManager.findMany({
        where: { userId: currentUser.id },
        select: { teamId: true },
      });
      const myTeamIds = userManagers.map((m) => m.teamId);
      if (myTeamIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: { matches: [], pagination: { total: 0, page, limit, totalPages: 0 } },
        });
      }

      where.OR = [{ teamAId: { in: myTeamIds } }, { teamBId: { in: myTeamIds } }];
    } else if (teamId) {
      where.OR = [{ teamAId: teamId }, { teamBId: teamId }];
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { teamA: { name: { contains: search, mode: 'insensitive' } } },
            { teamA: { tag: { contains: search, mode: 'insensitive' } } },
            { teamB: { name: { contains: search, mode: 'insensitive' } } },
            { teamB: { tag: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [total, matches] = await Promise.all([
      prisma.match.count({ where }),
      prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              tag: true,
              logoUrl: true,
              discordInvite: true,
              avgElo: true,
              stats: {
                select: {
                  winRate: true,
                  matchesPlayed: true,
                  wins: true,
                  losses: true,
                },
              },
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
              tag: true,
              logoUrl: true,
              discordInvite: true,
              avgElo: true,
              stats: {
                select: {
                  winRate: true,
                  matchesPlayed: true,
                  wins: true,
                  losses: true,
                },
              },
            },
          },
          maps: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              map: true,
              finalScoreA: true,
              finalScoreB: true,
              pickedBy: true,
            },
          },
        },
      }),
    ]);

    const payload = {
      success: true,
      data: {
        matches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };

    if (!myOnly) {
      memoryCache.set(cacheKey, payload, 60);
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/matches:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения списка матчей' },
      { status: 500 }
    );
  }
}

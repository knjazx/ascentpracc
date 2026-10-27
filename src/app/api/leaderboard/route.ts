import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minMatches = Math.max(0, parseInt(searchParams.get('minMatches') || '0', 10));
    const sortBy = searchParams.get('sortBy') || 'winRate';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.TeamWhereInput = {
      ...(minMatches > 0
        ? {
            stats: {
              matchesPlayed: { gte: minMatches },
            },
          }
        : {}),
    };

    let orderBy: Prisma.TeamOrderByWithRelationInput = {
      stats: {
        winRate: 'desc',
      },
    };

    if (sortBy === 'wins') {
      orderBy = { stats: { wins: 'desc' } };
    } else if (sortBy === 'matchesPlayed') {
      orderBy = { stats: { matchesPlayed: 'desc' } };
    }

    const [total, teams] = await Promise.all([
      prisma.team.count({ where }),
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          tag: true,
          logoUrl: true,
          description: true,
          discordInvite: true,
          noShowCount: true,
          createdAt: true,
          stats: {
            select: {
              matchesPlayed: true,
              wins: true,
              losses: true,
              draws: true,
              winRate: true,
              form: true,
              mapStats: true,
            },
          },
          ratingsReceived: {
            select: {
              punctuality: true,
              sportsmanship: true,
            },
          },
        },
      }),
    ]);

    // Calculate average ratings for each team
    const enriched = teams.map((t, idx) => {
      const ratingCount = t.ratingsReceived.length;
      let avgPunctuality = 5.0;
      let avgSportsmanship = 5.0;

      if (ratingCount > 0) {
        const sumP = t.ratingsReceived.reduce((acc, r) => acc + r.punctuality, 0);
        const sumS = t.ratingsReceived.reduce((acc, r) => acc + r.sportsmanship, 0);
        avgPunctuality = Number((sumP / ratingCount).toFixed(1));
        avgSportsmanship = Number((sumS / ratingCount).toFixed(1));
      }

      return {
        rank: skip + idx + 1,
        id: t.id,
        name: t.name,
        tag: t.tag,
        logoUrl: t.logoUrl,
        discordInvite: t.discordInvite,
        noShowCount: t.noShowCount,
        stats: t.stats || {
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          form: '',
          mapStats: {},
        },
        rating: {
          count: ratingCount,
          punctuality: avgPunctuality,
          sportsmanship: avgSportsmanship,
          average: Number(((avgPunctuality + avgSportsmanship) / 2).toFixed(1)),
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        teams: enriched,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/leaderboard:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения лидерборда' },
      { status: 500 }
    );
  }
}

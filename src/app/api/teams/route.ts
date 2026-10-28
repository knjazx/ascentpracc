import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { teamCreateSchema } from '@/lib/validations/team';
import { Prisma } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
  const skip = (page - 1) * limit;

  const cacheKey = `teams:${search}:${page}:${limit}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const where: Prisma.TeamWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { tag: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, teams] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      skip,
      take: limit,
      include: {
        stats: true,
        ratingsReceived: {
          select: {
            punctuality: true,
            sportsmanship: true,
          },
        },
        managers: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
                steamId: true,
              },
            },
          },
        },
        _count: {
          select: {
            matchesAsTeamA: true,
            matchesAsTeamB: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const payload = {
    success: true,
    data: {
      teams: teams.map((team) => {
        const ratings = team.ratingsReceived || [];
        const ratingCount = ratings.length;
        let avgPunctuality = 0.0;
        let avgSportsmanship = 0.0;
        let overallRating = 0.0;

        if (ratingCount > 0) {
          avgPunctuality = Number(
            (ratings.reduce((acc, r) => acc + r.punctuality, 0) / ratingCount).toFixed(1)
          );
          avgSportsmanship = Number(
            (ratings.reduce((acc, r) => acc + r.sportsmanship, 0) / ratingCount).toFixed(1)
          );
          overallRating = Number(((avgPunctuality + avgSportsmanship) / 2).toFixed(1));
        }

        const penalty = (team.noShowCount * 20);
        const trustFactor = Math.max(0, Math.min(100, 100 - penalty));

        const { ratingsReceived, _count, ...restTeam } = team;

        return {
          ...restTeam,
          totalMatches: _count.matchesAsTeamA + _count.matchesAsTeamB,
          ratingCount,
          avgPunctuality,
          avgSportsmanship,
          overallRating,
          trustFactor,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  };

  memoryCache.set(cacheKey, payload, 60);

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    // Check if user already owns or manages a team (limit: 1 team per user)
    const existingMembership = await prisma.teamManager.findFirst({
      where: { userId: user.id },
      include: { team: { select: { name: true, tag: true } } },
    });

    if (existingMembership) {
      return NextResponse.json(
        {
          success: false,
          error: `Вы уже состоите в команде [${existingMembership.team.tag}] ${existingMembership.team.name}. Каждый игрок может иметь только одну команду.`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = teamCreateSchema.parse(body);

    // Check unique name and tag
    const existing = await prisma.team.findFirst({
      where: {
        OR: [
          { name: { equals: validated.name, mode: 'insensitive' } },
          { tag: { equals: validated.tag, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      if (existing.name.toLowerCase() === validated.name.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Команда с таким названием уже существует' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Команда с таким тегом уже существует' },
        { status: 400 }
      );
    }

    // Create Team + Owner Manager + Initial Stats in single transaction
    const newTeam = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: validated.name,
          tag: validated.tag,
          description: validated.description || null,
          avgElo: validated.avgElo ?? null,
          discordInvite: validated.discordInvite || null,
          logoUrl: validated.logoUrl || null,
          managers: {
            create: {
              userId: user.id,
              isOwner: true,
            },
          },
          stats: {
            create: {
              matchesPlayed: 0,
              wins: 0,
              losses: 0,
              draws: 0,
              winRate: 0,
              form: '',
              mapStats: {},
              h2h: {},
            },
          },
        },
        include: {
          managers: {
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatarUrl: true,
                },
              },
            },
          },
          stats: true,
        },
      });
      return team;
    });

    memoryCache.invalidate('teams:');
    memoryCache.invalidate('leaderboard:');

    return NextResponse.json({ success: true, data: newTeam }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при создании команды';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

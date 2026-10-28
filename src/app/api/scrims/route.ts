import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { scrimCreateSchema } from '@/lib/validations/scrim';
import { ScrimStatus, MatchStatus, Prisma } from '@prisma/client';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { memoryCache } from '@/lib/memory-cache';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const serverBy = searchParams.get('serverBy');
  const dateFilter = searchParams.get('date');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
  const skip = (page - 1) * limit;

  const server = searchParams.get('server') || serverBy;
  const platform = searchParams.get('platform');
  const teamId = searchParams.get('teamId');

  const cacheKey = teamId
    ? null
    : `scrims:${format || 'all'}:${server || 'all'}:${platform || 'all'}:${dateFilter || 'all'}:${search || ''}:${page}:${limit}`;
  const cached = cacheKey ? memoryCache.get(cacheKey) : null;
  if (cached) {
    return NextResponse.json(cached);
  }

  const now = new Date();

  const where: Prisma.ScrimRequestWhereInput = {
    status: ScrimStatus.OPEN,
    expiresAt: { gt: now },
    NOT: { level: { startsWith: 'CHALLENGE:' } },
  };

  if (teamId) {
    where.teamId = teamId;
  }

  if (format && ['BO1', 'BO2', 'BO3'].includes(format)) {
    where.format = format as Prisma.EnumScrimFormatFilter['equals'];
  }

  if (server && server !== 'all') {
    if (server === 'negotiable' || server === 'NEGOTIABLE' || server === 'По договоренности') {
      where.OR = [
        { serverLocations: { equals: [] } },
        { serverBy: 'NEGOTIABLE' },
      ];
    } else if (server === 'HOST' || server === 'GUEST') {
      where.serverBy = server as Prisma.EnumServerByFilter['equals'];
    } else {
      where.serverLocations = { has: server };
    }
  }

  if (platform && ['CYBERSHOCK', 'XPLAY', 'FASTCUP', 'OTHER'].includes(platform)) {
    where.platform = platform;
  }

  if (search) {
    where.team = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { tag: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  if (dateFilter === 'today' || dateFilter === 'tomorrow') {
    const targetDate = dateFilter === 'today' ? now : addDays(now, 1);
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    where.slots = {
      some: {
        startsAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    };
  }

  const [total, scrims] = await Promise.all([
    prisma.scrimRequest.count({ where }),
    prisma.scrimRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            tag: true,
            logoUrl: true,
            avgElo: true,
            noShowCount: true,
            stats: {
              select: {
                winRate: true,
                matchesPlayed: true,
              },
            },
          },
        },
        slots: {
          orderBy: { startsAt: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const payload = {
    success: true,
    data: {
      scrims: scrims.map((s) => ({
        ...s,
        responsesCount: s._count.responses,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
  };

  if (cacheKey) {
    memoryCache.set(cacheKey, payload, 60);
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = scrimCreateSchema.parse(body);

    memoryCache.invalidate('scrims:');
    memoryCache.invalidate('feed:');
    memoryCache.invalidate('scrim:');

    // 1. Verify user is a manager of the team
    const managerRecord = await prisma.teamManager.findUnique({
      where: {
        teamId_userId: {
          teamId: validated.teamId,
          userId: user.id,
        },
      },
    });

    if (!managerRecord && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Вы не являетесь управляющим этой команды' },
        { status: 403 }
      );
    }

    // 2. Check open requests limit (strictly max 1 open scrim per team)
    const existingOpenScrim = await prisma.scrimRequest.findFirst({
      where: {
        teamId: validated.teamId,
        status: ScrimStatus.OPEN,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (existingOpenScrim) {
      return NextResponse.json(
        {
          success: false,
          error: 'У вашей команды уже есть открытая заявка на прак. Команда может иметь максимум 1 открытую заявку одновременно.',
        },
        { status: 400 }
      );
    }

    // 3. Check time overlaps with existing confirmed matches of this team
    const confirmedMatches = await prisma.match.findMany({
      where: {
        OR: [{ teamAId: validated.teamId }, { teamBId: validated.teamId }],
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.VETO, MatchStatus.LIVE] },
      },
      select: { scheduledAt: true },
    });

    for (const slot of validated.slots) {
      const slotStart = new Date(slot.startsAt).getTime();
      const slotEnd = slotStart + slot.durationMin * 60 * 1000;

      for (const match of confirmedMatches) {
        const matchStart = new Date(match.scheduledAt).getTime();
        const matchEnd = matchStart + 120 * 60 * 1000; // standard 2h match duration

        // Overlap condition
        if (slotStart < matchEnd && slotEnd > matchStart) {
          return NextResponse.json(
            {
              success: false,
              error: `Один из выбранных слотов (${new Date(slot.startsAt).toLocaleString('ru-RU')}) пересекается по времени с уже подтвержденным матчем команды.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 4. Determine expiresAt (until latest slot finishes: startsAt + durationMin)
    const slotEndTimes = validated.slots.map(
      (s) => new Date(s.startsAt).getTime() + (s.durationMin || 120) * 60 * 1000
    );
    const expiresAt = new Date(Math.max(...slotEndTimes));

    // 5. Create ScrimRequest + Slots in a transaction
    const createdRequest = await prisma.$transaction(async (tx) => {
      const scrim = await tx.scrimRequest.create({
        data: {
          teamId: validated.teamId,
          format: validated.format,
          level: validated.level || null,
          serverBy: validated.serverBy,
          serverLocations: validated.serverLocations,
          platform: validated.platform,
          excludedMaps: validated.excludedMaps,
          comment: validated.comment || null,
          expiresAt,
          slots: {
            create: validated.slots.map((s) => ({
              startsAt: new Date(s.startsAt),
              durationMin: s.durationMin,
            })),
          },
        },
        include: {
          slots: true,
          team: {
            select: { id: true, name: true, tag: true, logoUrl: true },
          },
        },
      });
      return scrim;
    });

    memoryCache.invalidate('scrims:');
    memoryCache.invalidate('scrims:');
    memoryCache.invalidate('feed:');
    memoryCache.invalidate('scrim:');

    return NextResponse.json({ success: true, data: createdRequest }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при создании заявки на прак';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

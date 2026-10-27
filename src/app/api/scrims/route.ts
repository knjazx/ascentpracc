import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { scrimCreateSchema } from '@/lib/validations/scrim';
import { ScrimStatus, MatchStatus, Prisma } from '@prisma/client';
import { addDays, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const serverBy = searchParams.get('serverBy');
  const dateFilter = searchParams.get('date');
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
  const skip = (page - 1) * limit;

  const now = new Date();

  const where: Prisma.ScrimRequestWhereInput = {
    status: ScrimStatus.OPEN,
    expiresAt: { gt: now },
  };

  if (format && ['BO1', 'BO2', 'BO3'].includes(format)) {
    where.format = format as Prisma.EnumScrimFormatFilter['equals'];
  }

  const server = searchParams.get('server') || serverBy;
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

  const platform = searchParams.get('platform');
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
          where: { startsAt: { gt: now } },
          orderBy: { startsAt: 'asc' },
        },
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json(
    {
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
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=10',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = scrimCreateSchema.parse(body);

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

    // 2. Check open requests limit (max 5)
    const openCount = await prisma.scrimRequest.count({
      where: {
        teamId: validated.teamId,
        status: ScrimStatus.OPEN,
        expiresAt: { gt: new Date() },
      },
    });

    if (openCount >= 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'Лимит открытых заявок для команды исчерпан (максимум 5). Дождитесь матчей или отмените старые.',
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

    // 4. Determine expiresAt (either 7 days from now or earliest slot start)
    const now = new Date();
    const defaultExpiry = new Date(now.getTime() + validated.expiresInDays * 24 * 60 * 60 * 1000);
    const earliestSlot = new Date(
      Math.min(...validated.slots.map((s) => new Date(s.startsAt).getTime()))
    );
    const expiresAt = earliestSlot < defaultExpiry ? earliestSlot : defaultExpiry;

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

    return NextResponse.json({ success: true, data: createdRequest }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при создании заявки на прак';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ScrimStatus, ScrimFormat, ServerBy, Role } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      challengerTeamId,
      targetTeamId,
      format = 'BO1',
      platform = 'CYBERSHOCK',
      serverLocations = [],
      slots = [],
      comment = '',
    } = body;

    if (!challengerTeamId || !targetTeamId) {
      return NextResponse.json(
        { success: false, error: 'Необходимо указать команду-отправителя и команду-соперника' },
        { status: 400 }
      );
    }

    if (challengerTeamId === targetTeamId) {
      return NextResponse.json(
        { success: false, error: 'Нельзя бросить вызов собственной команде' },
        { status: 400 }
      );
    }

    // 1. Verify user is a manager of challenger team or ADMIN
    const challengerManager = await prisma.teamManager.findUnique({
      where: {
        teamId_userId: {
          teamId: challengerTeamId,
          userId: user.id,
        },
      },
      include: {
        team: true,
      },
    });

    if (!challengerManager && user.role !== Role.ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Вы не являетесь управляющим команды-отправителя' },
        { status: 403 }
      );
    }

    // 2. Fetch target team and its managers (captains)
    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: {
        managers: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!targetTeam) {
      return NextResponse.json(
        { success: false, error: 'Команда, которой вы бросаете вызов, не найдена' },
        { status: 404 }
      );
    }

    // 3. Validate slots (1 to 3 slots, future, max 5 days)
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Укажите хотя бы один временной слот' },
        { status: 400 }
      );
    }

    if (slots.length > 3) {
      return NextResponse.json(
        { success: false, error: 'Максимум 3 предложения по времени' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const maxFutureTime = now + 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000;

    const parsedSlots: Array<{ startsAt: Date; durationMin: number }> = [];
    for (const slot of slots) {
      const slotTime = new Date(slot.startsAt).getTime();
      if (isNaN(slotTime)) {
        return NextResponse.json(
          { success: false, error: 'Некорректная дата или время слота' },
          { status: 400 }
        );
      }
      if (slotTime <= now) {
        return NextResponse.json(
          { success: false, error: 'Время слота должно быть в будущем' },
          { status: 400 }
        );
      }
      if (slotTime > maxFutureTime) {
        return NextResponse.json(
          { success: false, error: 'Время слота не может превышать 5 дней от момента создания вызова' },
          { status: 400 }
        );
      }
      parsedSlots.push({
        startsAt: new Date(slot.startsAt),
        durationMin: Number(slot.durationMin) || 120,
      });
    }

    // 4. Calculate expiresAt (until latest slot finishes)
    const slotEndTimes = parsedSlots.map((s) => s.startsAt.getTime() + s.durationMin * 60 * 1000);
    const expiresAt = new Date(Math.max(...slotEndTimes));

    // 5. Create Challenge (ScrimRequest with level = 'CHALLENGE:<targetTeamId>')
    const challengerTeam = challengerManager
      ? challengerManager.team
      : await prisma.team.findUniqueOrThrow({ where: { id: challengerTeamId } });

    const challenge = await prisma.$transaction(async (tx) => {
      const scrim = await tx.scrimRequest.create({
        data: {
          teamId: challengerTeamId,
          format: (format as ScrimFormat) || ScrimFormat.BO1,
          platform: String(platform || 'CYBERSHOCK'),
          serverBy: serverLocations.length > 0 ? ServerBy.HOST : ServerBy.NEGOTIABLE,
          serverLocations: Array.isArray(serverLocations) ? serverLocations : [],
          level: `CHALLENGE:${targetTeamId}`,
          comment: comment ? String(comment).trim().slice(0, 500) : null,
          status: ScrimStatus.OPEN,
          expiresAt,
          slots: {
            create: parsedSlots.map((s) => ({
              startsAt: s.startsAt,
              durationMin: s.durationMin,
            })),
          },
        },
        include: {
          slots: true,
          team: true,
        },
      });

      // 6. Create personal notifications for all managers of the target team
      const notifTitle = `⚔ Прямой вызов от команды [${challengerTeam.tag}]`;
      const notifMessage = `Команда ${challengerTeam.name} [${challengerTeam.tag}] бросила вашей команде [${targetTeam.tag}] персональный вызов на прак (${format}, ${platform})!${
        comment ? `\nСообщение: «${comment}»` : ''
      }`;

      for (const m of targetTeam.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: notifTitle,
            message: notifMessage,
            type: 'CHALLENGE',
            link: `/scrims/${scrim.id}`,
          },
        });
      }

      return scrim;
    });

    memoryCache.invalidate('scrims:');
    memoryCache.invalidate('scrim:');

    return NextResponse.json({
      success: true,
      data: {
        id: challenge.id,
        targetTeam: {
          id: targetTeam.id,
          name: targetTeam.name,
          tag: targetTeam.tag,
        },
      },
    });
  } catch (err: unknown) {
    console.error('Error creating direct challenge:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Ошибка при создании вызова' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');

  if (!teamId) {
    return NextResponse.json({ success: false, error: 'Укажите teamId' }, { status: 400 });
  }

  const now = new Date();

  // Incoming challenges to this team
  const incoming = await prisma.scrimRequest.findMany({
    where: {
      level: `CHALLENGE:${teamId}`,
      status: ScrimStatus.OPEN,
      expiresAt: { gt: now },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          tag: true,
          logoUrl: true,
          avgElo: true,
        },
      },
      slots: {
        orderBy: { startsAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Outgoing challenges sent by this team
  const outgoing = await prisma.scrimRequest.findMany({
    where: {
      teamId,
      level: { startsWith: 'CHALLENGE:' },
      status: ScrimStatus.OPEN,
      expiresAt: { gt: now },
    },
    include: {
      slots: {
        orderBy: { startsAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    success: true,
    data: {
      incoming,
      outgoing,
    },
  });
}

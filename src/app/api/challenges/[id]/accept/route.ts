import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ScrimStatus, MatchStatus, Role } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { slotId } = body;

    // 1. Fetch challenge with slots & challenger team
    const challenge = await prisma.scrimRequest.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            managers: true,
          },
        },
        slots: true,
        match: true,
      },
    });

    if (!challenge) {
      return NextResponse.json({ success: false, error: 'Вызов не найден' }, { status: 404 });
    }

    if (!challenge.level?.startsWith('CHALLENGE:')) {
      return NextResponse.json(
        { success: false, error: 'Данная заявка не является персональным вызовом' },
        { status: 400 }
      );
    }

    if (challenge.status !== ScrimStatus.OPEN) {
      return NextResponse.json(
        { success: false, error: 'Этот вызов больше не активен (уже принят, отменен или истек)' },
        { status: 400 }
      );
    }

    const targetTeamId = challenge.level.replace('CHALLENGE:', '');

    // 2. Fetch target team and verify user is a manager or ADMIN
    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: {
        managers: true,
      },
    });

    if (!targetTeam) {
      return NextResponse.json({ success: false, error: 'Команда не найдена' }, { status: 404 });
    }

    const isTargetManager =
      targetTeam.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;

    if (!isTargetManager) {
      return NextResponse.json(
        { success: false, error: 'Только капитан или управляющий целевой команды может принять вызов' },
        { status: 403 }
      );
    }

    // 3. Find the chosen slot
    const selectedSlot = slotId
      ? challenge.slots.find((s) => s.id === slotId)
      : challenge.slots[0];

    if (!selectedSlot) {
      return NextResponse.json(
        { success: false, error: 'Не удалось определить выбранный временной слот' },
        { status: 400 }
      );
    }

    const scheduledAt = selectedSlot.startsAt;
    const matchStart = new Date(scheduledAt).getTime();
    const matchEnd = matchStart + (selectedSlot.durationMin || 120) * 60 * 1000;

    // 4. Check schedule conflict for BOTH teams
    const conflictingMatches = await prisma.match.findMany({
      where: {
        OR: [
          { teamAId: challenge.teamId },
          { teamBId: challenge.teamId },
          { teamAId: targetTeamId },
          { teamBId: targetTeamId },
        ],
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.VETO, MatchStatus.LIVE] },
      },
    });

    for (const m of conflictingMatches) {
      const existingStart = new Date(m.scheduledAt).getTime();
      const existingEnd = existingStart + 120 * 60 * 1000;

      if (matchStart < existingEnd && matchEnd > existingStart) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Невозможно подтвердить матч: одна из команд уже имеет подтвержденный матч на это время.',
          },
          { status: 400 }
        );
      }
    }

    // 5. In a transaction, create Match and mark Challenge as MATCHED
    const result = await prisma.$transaction(async (tx) => {
      // Create Match
      const match = await tx.match.create({
        data: {
          requestId: challenge.id,
          teamAId: challenge.teamId, // Challenger team
          teamBId: targetTeamId,     // Target team
          format: challenge.format,
          platform: challenge.platform,
          scheduledAt,
          status: MatchStatus.SCHEDULED,
        },
      });

      // Update challenge status
      await tx.scrimRequest.update({
        where: { id: challenge.id },
        data: { status: ScrimStatus.MATCHED },
      });

      const dateStr = new Date(scheduledAt).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Notify challenger team managers
      for (const m of challenge.team.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: `⚔ Вызов принят! Матч сформирован`,
            message: `Команда ${targetTeam.name} [${targetTeam.tag}] приняла ваш персональный вызов! Матч назначен на ${dateStr}. Перейдите в лобби матча.`,
            type: 'MATCH_CREATED',
            link: `/lobby/${match.id}`,
          },
        });
      }

      // Notify target team managers
      for (const m of targetTeam.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: `⚔ Вызов от [${challenge.team.tag}] принят`,
            message: `Вы приняли вызов команды ${challenge.team.name} [${challenge.team.tag}]! Матч назначен на ${dateStr}. Перейдите в лобби матча.`,
            type: 'MATCH_CREATED',
            link: `/lobby/${match.id}`,
          },
        });
      }

      return match;
    });

    memoryCache.invalidate('scrims:');
    memoryCache.invalidate('scrim:');
    memoryCache.invalidate('matches:');

    return NextResponse.json({
      success: true,
      data: {
        matchId: result.id,
      },
    });
  } catch (err: unknown) {
    console.error('Error accepting challenge:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Ошибка при принятии вызова' },
      { status: 500 }
    );
  }
}

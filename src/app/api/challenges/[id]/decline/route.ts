import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ScrimStatus, Role } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id } = params;

  try {
    const challenge = await prisma.scrimRequest.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            managers: true,
          },
        },
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
        { success: false, error: 'Этот вызов больше не находится в статусе ожидания' },
        { status: 400 }
      );
    }

    const targetTeamId = challenge.level.replace('CHALLENGE:', '');
    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      include: {
        managers: true,
      },
    });

    const isChallengerManager =
      challenge.team.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;
    const isTargetManager =
      targetTeam?.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;

    if (!isChallengerManager && !isTargetManager) {
      return NextResponse.json(
        { success: false, error: 'У вас нет прав для отмены или отклонения этого вызова' },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Mark as cancelled
      await tx.scrimRequest.update({
        where: { id: challenge.id },
        data: { status: ScrimStatus.CANCELLED },
      });

      // If target team declined, notify challenger team managers
      if (isTargetManager && !isChallengerManager) {
        for (const m of challenge.team.managers) {
          await tx.notification.create({
            data: {
              userId: m.userId,
              title: `Вызов отклонен`,
              message: `Команда ${targetTeam?.name || ''} [${targetTeam?.tag || ''}] отклонила ваш персональный вызов.`,
              type: 'CHALLENGE_DECLINED',
              link: `/teams/${targetTeamId}`,
            },
          });
        }
      }
    });

    memoryCache.invalidate('scrims:');
    memoryCache.invalidate('scrim:');

    return NextResponse.json({
      success: true,
      message: isTargetManager ? 'Вызов отклонен' : 'Вызов отозван',
    });
  } catch (err: unknown) {
    console.error('Error declining challenge:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Ошибка при отклонении вызова' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { MatchStatus, Role } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: matchId } = params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { managers: true } },
      teamB: { include: { managers: true } },
    },
  });

  if (!match) {
    return NextResponse.json({ success: false, error: 'Матч не найден' }, { status: 404 });
  }

  const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
  const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);
  const isAdmin = user.role === Role.ADMIN;

  if (!isManagerA && !isManagerB && !isAdmin) {
    return NextResponse.json({ success: false, error: 'Недостаточно прав' }, { status: 403 });
  }

  if (match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.CANCELLED) {
    return NextResponse.json({ success: false, error: 'Нельзя отменить завершенный матч' }, { status: 400 });
  }

  const callerTeamTag = isManagerA ? match.teamA.tag : isManagerB ? match.teamB.tag : 'Судья';

  // Check audit log for pending cancellation proposal from the other team
  const pendingCancelLog = await prisma.auditLog.findFirst({
    where: {
      matchId,
      action: 'CANCEL_PROPOSED',
    },
    orderBy: { createdAt: 'desc' },
  });

  const proposedByOtherTeam =
    pendingCancelLog &&
    pendingCancelLog.userId !== user.id &&
    Date.now() - new Date(pendingCancelLog.createdAt).getTime() < 30 * 60 * 1000;

  if (isAdmin || proposedByOtherTeam) {
    // Mutual agreement achieved or admin action -> cancel match
    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.CANCELLED },
      });

      await tx.chatMessage.create({
        data: {
          matchId,
          system: true,
          text: `Матч был отменен по взаимному согласию сторон.`,
        },
      });

      await tx.auditLog.create({
        data: {
          matchId,
          userId: user.id,
          action: 'CANCEL_CONFIRMED',
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Матч успешно отменен по согласию сторон' });
  } else {
    // First team proposes cancellation
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          matchId,
          userId: user.id,
          action: 'CANCEL_PROPOSED',
        },
      });

      await tx.chatMessage.create({
        data: {
          matchId,
          system: true,
          text: `Команда [${callerTeamTag}] запросила отмену матча. Для отмены соперник должен также подтвердить запрос.`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Запрос на отмену отправлен. Ожидается подтверждение соперника.',
    });
  }
}

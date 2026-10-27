import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { MatchStatus, ReportTargetType, ReportStatus } from '@prisma/client';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: matchId } = params;

  try {
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

    if (match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.CANCELLED) {
      return NextResponse.json(
        { success: false, error: 'Матч уже завершен или отменен' },
        { status: 400 }
      );
    }

    const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
    const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);

    if (!isManagerA && !isManagerB) {
      return NextResponse.json(
        { success: false, error: 'Вы не являетесь менеджером ни одной из команд матча' },
        { status: 403 }
      );
    }

    // Verify at least 15 minutes have passed since scheduledAt
    const scheduledTime = new Date(match.scheduledAt).getTime();
    const now = Date.now();
    const minWaitMs = 15 * 60 * 1000;

    if (now < scheduledTime + minWaitMs) {
      const minutesLeft = Math.ceil((scheduledTime + minWaitMs - now) / 60000);
      return NextResponse.json(
        {
          success: false,
          error: `Зафиксировать неявку можно только через 15 минут после начала матча (осталось ${minutesLeft} мин)`,
        },
        { status: 400 }
      );
    }

    const reportingTeam = isManagerA ? match.teamA : match.teamB;
    const opponentTeam = isManagerA ? match.teamB : match.teamA;
    const opponentManagers = isManagerA ? match.teamB.managers : match.teamA.managers;

    await prisma.$transaction(async (tx) => {
      // 1. Increment noShowCount
      await tx.team.update({
        where: { id: opponentTeam.id },
        data: {
          noShowCount: { increment: 1 },
        },
      });

      // 2. Mark match as cancelled
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.CANCELLED,
        },
      });

      // 3. Create Report
      await tx.report.create({
        data: {
          reporterId: user.id,
          targetType: ReportTargetType.TEAM,
          targetId: opponentTeam.id,
          reason: `Неявка команды [${opponentTeam.tag}] на матч #${matchId}. Заявитель: [${reportingTeam.tag}].`,
          status: ReportStatus.PENDING,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          matchId,
          userId: user.id,
          action: 'NO_SHOW_REPORTED',
          payload: {
            reportedTeamId: opponentTeam.id,
            reportedTeamTag: opponentTeam.tag,
          },
        },
      });

      // 5. System Chat Message
      await tx.chatMessage.create({
        data: {
          matchId,
          system: true,
          text: `Команда [${reportingTeam.tag}] зафиксировала техническую неявку соперника [${opponentTeam.tag}]. Матч отменен, жалоба направлена судьям.`,
        },
      });

      // 6. Notifications to opponent
      for (const m of opponentManagers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: 'Техническая неявка на матч',
            message: `Команда [${reportingTeam.tag}] зафиксировала неявку вашей команды на матч #${matchId}. Счётчик No-Show увеличен.`,
            type: 'NO_SHOW_ALERT',
            link: `/matches/${matchId}`,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Неявка зафиксирована. Матч отменен, жалоба передана администрации лиги.',
    });
  } catch (err: unknown) {
    console.error('Error in POST /api/matches/[id]/no-show:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка фиксации неявки' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { RescheduleStatus, Role } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: matchId } = params;

  try {
    const body = await request.json();
    const { action, proposedAt, requestId, status } = body;

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

    const callerTeamId = isManagerA ? match.teamAId : match.teamBId;
    const callerTeamTag = isManagerA ? match.teamA.tag : match.teamB.tag;

    // Action 1: Propose Reschedule
    if (action === 'propose') {
      if (!proposedAt) {
        return NextResponse.json({ success: false, error: 'Укажите новую дату и время' }, { status: 400 });
      }

      const parsedProposed = new Date(proposedAt);
      if (parsedProposed.getTime() <= Date.now()) {
        return NextResponse.json({ success: false, error: 'Время переноса должно быть в будущем' }, { status: 400 });
      }

      const resReq = await prisma.$transaction(async (tx) => {
        // Cancel any pending reschedule requests first
        await tx.rescheduleRequest.updateMany({
          where: { matchId, status: RescheduleStatus.PENDING },
          data: { status: RescheduleStatus.DECLINED },
        });

        const created = await tx.rescheduleRequest.create({
          data: {
            matchId,
            byTeamId: callerTeamId,
            proposedAt: parsedProposed,
            status: RescheduleStatus.PENDING,
          },
          include: { byTeam: { select: { tag: true, name: true } } },
        });

        await tx.chatMessage.create({
          data: {
            matchId,
            system: true,
            text: `Команда [${callerTeamTag}] запросила перенос матча на ${parsedProposed.toLocaleString('ru-RU')}.`,
          },
        });

        return created;
      });

      return NextResponse.json({ success: true, data: resReq });
    }

    // Action 2: Respond to Reschedule (ACCEPT / DECLINE)
    if (action === 'respond') {
      if (!requestId || !['ACCEPTED', 'DECLINED'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Некорректные параметры ответа' }, { status: 400 });
      }

      const resReq = await prisma.rescheduleRequest.findUnique({
        where: { id: requestId },
      });

      if (!resReq || resReq.matchId !== matchId || resReq.status !== RescheduleStatus.PENDING) {
        return NextResponse.json({ success: false, error: 'Запрос на перенос не найден или неактивен' }, { status: 404 });
      }

      // Must be opponent or admin to accept/decline
      if (resReq.byTeamId === callerTeamId && !isAdmin) {
        return NextResponse.json({ success: false, error: 'Нельзя ответить на собственный запрос переноса' }, { status: 400 });
      }

      if (status === 'ACCEPTED') {
        await prisma.$transaction(async (tx) => {
          await tx.rescheduleRequest.update({
            where: { id: requestId },
            data: { status: RescheduleStatus.ACCEPTED },
          });

          await tx.match.update({
            where: { id: matchId },
            data: { scheduledAt: resReq.proposedAt },
          });

          await tx.chatMessage.create({
            data: {
              matchId,
              system: true,
              text: `Перенос матча подтвержден! Новое время: ${resReq.proposedAt.toLocaleString('ru-RU')}.`,
            },
          });
        });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.rescheduleRequest.update({
            where: { id: requestId },
            data: { status: RescheduleStatus.DECLINED },
          });

          await tx.chatMessage.create({
            data: {
              matchId,
              system: true,
              text: `Запрос на перенос матча был отклонен.`,
            },
          });
        });
      }

      return NextResponse.json({ success: true, message: `Запрос на перенос: ${status}` });
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при обработке переноса';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

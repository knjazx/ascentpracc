import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ScrimStatus, ResponseStatus, MatchStatus, Role } from '@prisma/client';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; responseId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: requestId, responseId } = params;

  // 1. Fetch ScrimRequest with author team managers
  const scrim = await prisma.scrimRequest.findUnique({
    where: { id: requestId },
    include: {
      team: {
        include: {
          managers: true,
        },
      },
      slots: true,
    },
  });

  if (!scrim) {
    return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 });
  }

  // 2. Caller must be manager of the host team or ADMIN
  const isAuthorManager =
    scrim.team.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;

  if (!isAuthorManager) {
    return NextResponse.json(
      { success: false, error: 'Только капитан команды-организатора может принимать отклики' },
      { status: 403 }
    );
  }

  // 3. Fetch ScrimResponse
  const responseItem = await prisma.scrimResponse.findUnique({
    where: { id: responseId },
    include: {
      team: {
        include: {
          managers: true,
        },
      },
      slot: true,
    },
  });

  if (!responseItem || responseItem.requestId !== requestId) {
    return NextResponse.json({ success: false, error: 'Отклик не найден' }, { status: 404 });
  }

  if (responseItem.status !== ResponseStatus.PENDING) {
    return NextResponse.json(
      { success: false, error: 'Этот отклик больше не находится в статусе ожидания' },
      { status: 400 }
    );
  }

  // 4. Determine final scheduledAt
  const scheduledAt = responseItem.slot
    ? responseItem.slot.startsAt
    : responseItem.proposedAt || new Date();

  const matchStart = new Date(scheduledAt).getTime();
  const matchEnd = matchStart + 120 * 60 * 1000;

  // 5. Check schedule conflict for BOTH teams
  const conflictingMatches = await prisma.match.findMany({
    where: {
      OR: [
        { teamAId: scrim.teamId },
        { teamBId: scrim.teamId },
        { teamAId: responseItem.teamId },
        { teamBId: responseItem.teamId },
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

  // 6. Execute atomic transaction (Row Lock pattern using optimistic where condition)
  try {
    const match = await prisma.$transaction(async (tx) => {
      // Atomic status change from OPEN -> MATCHED
      // If affected rows === 0, another concurrent request already accepted!
      const updateResult = await tx.scrimRequest.updateMany({
        where: {
          id: requestId,
          status: ScrimStatus.OPEN,
        },
        data: {
          status: ScrimStatus.MATCHED,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Заявка уже была принята другим соперником или отменена');
      }

      // Mark chosen response as ACCEPTED
      await tx.scrimResponse.update({
        where: { id: responseId },
        data: { status: ResponseStatus.ACCEPTED },
      });

      // Decline all other pending responses
      await tx.scrimResponse.updateMany({
        where: {
          requestId,
          id: { not: responseId },
          status: ResponseStatus.PENDING,
        },
        data: {
          status: ResponseStatus.DECLINED,
        },
      });

      // Create Match
      const createdMatch = await tx.match.create({
        data: {
          requestId: scrim.id,
          teamAId: scrim.teamId,
          teamBId: responseItem.teamId,
          format: scrim.format,
          platform: scrim.platform,
          scheduledAt,
          status: MatchStatus.SCHEDULED,
        },
      });

      // Send In-App Notifications
      // For Host team
      for (const m of scrim.team.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: 'Матч подтвержден!',
            message: `Прак против команды ${responseItem.team.name} [${responseItem.team.tag}] подтвержден на ${scheduledAt.toLocaleString('ru-RU')}. Перейдите в лобби для подготовки.`,
            type: 'MATCH_CREATED',
            link: `/lobby/${createdMatch.id}`,
          },
        });
      }

      // For Responding team
      for (const m of responseItem.team.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: 'Ваш отклик на прак принят!',
            message: `Команда ${scrim.team.name} [${scrim.team.tag}] приняла ваш отклик. Матч назначен на ${scheduledAt.toLocaleString('ru-RU')}. Перейдите в лобби.`,
            type: 'MATCH_CREATED',
            link: `/lobby/${createdMatch.id}`,
          },
        });
      }

      return createdMatch;
    });

    return NextResponse.json({
      success: true,
      message: 'Отклик успешно принят, матч создан!',
      data: { matchId: match.id },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при принятии отклика';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

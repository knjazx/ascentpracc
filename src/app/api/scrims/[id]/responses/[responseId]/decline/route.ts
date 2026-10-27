import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ResponseStatus, Role } from '@prisma/client';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; responseId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: requestId, responseId } = params;

  const scrim = await prisma.scrimRequest.findUnique({
    where: { id: requestId },
    include: { team: { include: { managers: true } } },
  });

  if (!scrim) {
    return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 });
  }

  const isAuthorManager =
    scrim.team.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;

  if (!isAuthorManager) {
    return NextResponse.json({ success: false, error: 'Недостаточно прав' }, { status: 403 });
  }

  const response = await prisma.scrimResponse.findUnique({
    where: { id: responseId },
    include: { team: { include: { managers: true } } },
  });

  if (!response || response.requestId !== requestId) {
    return NextResponse.json({ success: false, error: 'Отклик не найден' }, { status: 404 });
  }

  if (response.status !== ResponseStatus.PENDING) {
    return NextResponse.json(
      { success: false, error: 'Отклонить можно только отклик в статусе ожидания' },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.scrimResponse.update({
      where: { id: responseId },
      data: { status: ResponseStatus.DECLINED },
    });

    for (const m of response.team.managers) {
      await tx.notification.create({
        data: {
          userId: m.userId,
          title: 'Отклик на прак отклонен',
          message: `Команда ${scrim.team.name} [${scrim.team.tag}] отклонила ваш отклик.`,
          type: 'SCRIM_RESPONSE_DECLINED',
          link: `/scrims/${requestId}`,
        },
      });
    }
  });

  return NextResponse.json({ success: true, message: 'Отклик отклонен' });
}

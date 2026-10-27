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

  const response = await prisma.scrimResponse.findUnique({
    where: { id: responseId },
    include: { team: { include: { managers: true } } },
  });

  if (!response || response.requestId !== requestId) {
    return NextResponse.json({ success: false, error: 'Отклик не найден' }, { status: 404 });
  }

  const isRespondingManager =
    response.team.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;

  if (!isRespondingManager) {
    return NextResponse.json(
      { success: false, error: 'Только капитан команды, отправившей отклик, может отозвать его' },
      { status: 403 }
    );
  }

  if (response.status !== ResponseStatus.PENDING) {
    return NextResponse.json(
      { success: false, error: 'Отозвать можно только ожидающий отклик' },
      { status: 400 }
    );
  }

  await prisma.scrimResponse.update({
    where: { id: responseId },
    data: { status: ResponseStatus.WITHDRAWN },
  });

  return NextResponse.json({ success: true, message: 'Отклик успешно отозван' });
}

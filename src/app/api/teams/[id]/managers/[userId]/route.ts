import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: teamId, userId: targetUserId } = params;

  // Caller permissions
  const callerManager = await prisma.teamManager.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });

  const isOwner = callerManager?.isOwner;
  const isSelf = user.id === targetUserId;
  const isAdmin = user.role === Role.ADMIN;

  if (!isOwner && !isSelf && !isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Недостаточно прав для удаления со-управляющего' },
      { status: 403 }
    );
  }

  const targetManager = await prisma.teamManager.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });

  if (!targetManager) {
    return NextResponse.json(
      { success: false, error: 'Управляющий не найден' },
      { status: 404 }
    );
  }

  if (targetManager.isOwner) {
    return NextResponse.json(
      {
        success: false,
        error: 'Владелец команды не может удалить себя. Передайте владение или удалите команду целиком.',
      },
      { status: 400 }
    );
  }

  await prisma.teamManager.delete({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });

  return NextResponse.json({ success: true, message: 'Со-управляющий успешно удален' });
}

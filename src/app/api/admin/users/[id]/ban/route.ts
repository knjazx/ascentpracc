import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';
import { z } from 'zod';

const banSchema = z.object({
  banned: z.boolean(),
  reason: z.string().max(300).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  const { id: targetUserId } = params;

  if (targetUserId === admin.id) {
    return NextResponse.json(
      { success: false, error: 'Нельзя заблокировать самого себя' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { banned, reason } = banSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { banned },
    });

    if (banned) {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: 'Аккаунт заблокирован',
          message: reason || 'Ваш аккаунт был заблокирован администратором лиги за нарушение правил.',
          type: 'ACCOUNT_BANNED',
          link: '/banned',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: banned ? 'Пользователь заблокирован' : 'Пользователь разблокирован',
      data: updatedUser,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error banning user:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления статуса блокировки' },
      { status: 500 }
    );
  }
}

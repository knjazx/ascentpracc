import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const [unreadCount, notifications] = await Promise.all([
      prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        unreadCount,
        notifications,
      },
    });
  } catch (err: unknown) {
    console.error('Error fetching notifications:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения уведомлений' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true, message: 'Все уведомления прочитаны' });
    }

    if (id) {
      await prisma.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
      });
      return NextResponse.json({ success: true, message: 'Уведомление прочитано' });
    }

    return NextResponse.json({ success: false, error: 'Укажите id или markAll' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Error updating notification:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка обновления уведомлений' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    await prisma.notification.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true, message: 'Все уведомления удалены' });
  } catch (err: unknown) {
    console.error('Error deleting notifications:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка удаления уведомлений' },
      { status: 500 }
    );
  }
}

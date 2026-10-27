import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';
import { z } from 'zod';

const blacklistSchema = z.object({
  blockedTeamId: z.string(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: teamId } = params;

  try {
    const isManager = await prisma.teamManager.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (!isManager && user.role !== Role.ADMIN) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const blacklists = await prisma.teamBlacklist.findMany({
      where: { teamId },
      include: {
        blockedTeam: {
          select: { id: true, name: true, tag: true, logoUrl: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: blacklists,
    });
  } catch (err: unknown) {
    console.error('Error fetching blacklist:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения черного списка' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: teamId } = params;

  try {
    const isManager = await prisma.teamManager.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (!isManager && user.role !== Role.ADMIN) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json();
    const { blockedTeamId } = blacklistSchema.parse(body);

    if (blockedTeamId === teamId) {
      return NextResponse.json(
        { success: false, error: 'Нельзя добавить свою же команду в черный список' },
        { status: 400 }
      );
    }

    const created = await prisma.teamBlacklist.upsert({
      where: {
        teamId_blockedTeamId: {
          teamId,
          blockedTeamId,
        },
      },
      update: {},
      create: {
        teamId,
        blockedTeamId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Команда добавлена в черный список',
      data: created,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error adding to blacklist:', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось добавить команду в черный список' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: teamId } = params;

  try {
    const isManager = await prisma.teamManager.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (!isManager && user.role !== Role.ADMIN) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json();
    const { blockedTeamId } = blacklistSchema.parse(body);

    await prisma.teamBlacklist.deleteMany({
      where: {
        teamId,
        blockedTeamId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Команда удалена из черного списка',
    });
  } catch (err: unknown) {
    console.error('Error removing from blacklist:', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось удалить команду из черного списка' },
      { status: 500 }
    );
  }
}

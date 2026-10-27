import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { addManagerSchema } from '@/lib/validations/team';
import { Role } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: teamId } = params;

  // Verify that caller is team owner or admin
  const callerManager = await prisma.teamManager.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });

  if ((!callerManager || !callerManager.isOwner) && user.role !== Role.ADMIN) {
    return NextResponse.json(
      { success: false, error: 'Только владелец команды может добавлять со-управляющих' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validated = addManagerSchema.parse(body);
    const identifier = validated.identifier.trim();

    // Find target user by steamId or nickname
    const isSteamId = /^\d{17}$/.test(identifier);
    const targetUser = await prisma.user.findFirst({
      where: isSteamId
        ? { steamId: identifier }
        : { nickname: { equals: identifier, mode: 'insensitive' } },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Пользователь не найден. Он должен хотя бы один раз авторизоваться на платформе через Steam.',
        },
        { status: 404 }
      );
    }

    // Check if already a manager
    const alreadyManager = await prisma.teamManager.findUnique({
      where: { teamId_userId: { teamId, userId: targetUser.id } },
    });

    if (alreadyManager) {
      return NextResponse.json(
        { success: false, error: 'Этот пользователь уже является управляющим команды' },
        { status: 400 }
      );
    }

    // Check if target user already belongs to another team (limit: 1 team per user)
    const targetUserExistingTeam = await prisma.teamManager.findFirst({
      where: { userId: targetUser.id },
      include: { team: { select: { name: true, tag: true } } },
    });

    if (targetUserExistingTeam) {
      return NextResponse.json(
        {
          success: false,
          error: `Игрок ${targetUser.nickname} уже состоит в команде [${targetUserExistingTeam.team.tag}] ${targetUserExistingTeam.team.name}. Каждый игрок может иметь только одну команду.`,
        },
        { status: 400 }
      );
    }

    const createdManager = await prisma.teamManager.create({
      data: {
        teamId,
        userId: targetUser.id,
        isOwner: false,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            steamId: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: createdManager }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при добавлении управляющего';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

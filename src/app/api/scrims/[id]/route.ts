import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ScrimStatus, Role } from '@prisma/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const user = await getCurrentUser();

  const scrim = await prisma.scrimRequest.findUnique({
    where: { id },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          tag: true,
          logoUrl: true,
          discordInvite: true,
          noShowCount: true,
          stats: {
            select: {
              winRate: true,
              matchesPlayed: true,
              wins: true,
              losses: true,
              draws: true,
              form: true,
            },
          },
          managers: {
            select: {
              userId: true,
              isOwner: true,
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      },
      slots: {
        orderBy: { startsAt: 'asc' },
      },
      match: {
        select: { id: true, status: true },
      },
    },
  });

  if (!scrim) {
    return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 });
  }

  // Check if current user is an author manager or admin
  const isAuthorManager =
    user && (scrim.team.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN);

  // If author manager, include all responses.
  // Otherwise, include only responses from teams managed by current user.
  let responses: unknown[] = [];
  if (isAuthorManager) {
    responses = await prisma.scrimResponse.findMany({
      where: { requestId: id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            tag: true,
            logoUrl: true,
            noShowCount: true,
            stats: {
              select: { winRate: true, matchesPlayed: true },
            },
          },
        },
        slot: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } else if (user) {
    // Check if user has teams that responded
    const userTeamIds = (
      await prisma.teamManager.findMany({
        where: { userId: user.id },
        select: { teamId: true },
      })
    ).map((tm) => tm.teamId);

    if (userTeamIds.length > 0) {
      responses = await prisma.scrimResponse.findMany({
        where: {
          requestId: id,
          teamId: { in: userTeamIds },
        },
        include: {
          team: {
            select: { id: true, name: true, tag: true, logoUrl: true },
          },
          slot: true,
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      ...scrim,
      isAuthor: Boolean(isAuthorManager),
      responses,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id } = params;

  const scrim = await prisma.scrimRequest.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          managers: true,
        },
      },
    },
  });

  if (!scrim) {
    return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 });
  }

  const isManager = scrim.team.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;
  if (!isManager) {
    return NextResponse.json(
      { success: false, error: 'У вас нет прав для отмены этой заявки' },
      { status: 403 }
    );
  }

  if (scrim.status !== ScrimStatus.OPEN) {
    return NextResponse.json(
      { success: false, error: 'Нельзя отменить заявку, которая уже не является открытой' },
      { status: 400 }
    );
  }

  await prisma.scrimRequest.update({
    where: { id },
    data: { status: ScrimStatus.CANCELLED },
  });

  return NextResponse.json({ success: true, message: 'Заявка успешно отменена' });
}

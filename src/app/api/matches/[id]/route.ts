import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getVetoState } from '@/lib/veto/state-machine';
import { Role } from '@prisma/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id } = params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      teamA: {
        include: {
          managers: {
            include: {
              user: {
                select: { id: true, nickname: true, avatarUrl: true, steamId: true },
              },
            },
          },
          stats: true,
        },
      },
      teamB: {
        include: {
          managers: {
            include: {
              user: {
                select: { id: true, nickname: true, avatarUrl: true, steamId: true },
              },
            },
          },
          stats: true,
        },
      },
      request: true,
      vetoActions: {
        orderBy: { order: 'asc' },
      },
      maps: {
        orderBy: { order: 'asc' },
      },
      chatMessages: {
        take: 100,
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, nickname: true, avatarUrl: true },
          },
          team: {
            select: { id: true, tag: true },
          },
        },
      },
      rescheduleRequests: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!match) {
    return NextResponse.json({ success: false, error: 'Матч не найден' }, { status: 404 });
  }

  const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
  const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);
  const isAdmin = user.role === Role.ADMIN;

  if (!isManagerA && !isManagerB && !isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Доступ к лобби разрешен только капитанам команд и администраторам' },
      { status: 403 }
    );
  }

  const vetoState = await getVetoState(id);

  return NextResponse.json({
    success: true,
    data: {
      ...match,
      userTeamRole: isManagerA ? 'TEAM_A' : isManagerB ? 'TEAM_B' : 'ADMIN',
      vetoState,
    },
  });
}

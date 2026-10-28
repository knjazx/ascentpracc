import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ScrimStatus, Role } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const user = await getCurrentUser();

  const cacheKey = `scrim:detail:${id}:${user?.id || 'anon'}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

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
          avgElo: true,
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

  // If this is a direct challenge, fetch target team and determine if current user is target manager
  let targetTeam: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    avgElo: number | null;
    managers: Array<{ userId: string; isOwner: boolean }>;
  } | null = null;
  let isTargetManager = false;

  if (scrim.level?.startsWith('CHALLENGE:')) {
    const targetTeamId = scrim.level.replace('CHALLENGE:', '');
    targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      select: {
        id: true,
        name: true,
        tag: true,
        logoUrl: true,
        avgElo: true,
        managers: {
          select: {
            userId: true,
            isOwner: true,
          },
        },
      },
    });

    if (targetTeam && user) {
      isTargetManager =
        targetTeam.managers.some((m) => m.userId === user.id) || user.role === Role.ADMIN;
    }
  }

  // If author manager, include all responses with avgElo and computed trustFactor.
  // Otherwise, include only responses from teams managed by current user.
  let responses: unknown[] = [];
  if (isAuthorManager) {
    const rawResponses = await prisma.scrimResponse.findMany({
      where: { requestId: id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            tag: true,
            logoUrl: true,
            noShowCount: true,
            avgElo: true,
            stats: {
              select: { winRate: true, matchesPlayed: true },
            },
          },
        },
        slot: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const teamIds = rawResponses.map((r) => r.team.id);
    const reports = await prisma.report.groupBy({
      by: ['targetId'],
      where: {
        targetType: 'TEAM',
        targetId: { in: teamIds },
        status: { in: ['PENDING', 'REVIEWED', 'RESOLVED'] },
      },
      _count: true,
    });
    const reportsMap = new Map(reports.map((r) => [r.targetId, r._count]));

    responses = rawResponses.map((r) => {
      const activeReports = reportsMap.get(r.team.id) || 0;
      const penalty = (r.team.noShowCount * 20) + (activeReports * 15);
      const trustFactor = Math.max(0, Math.min(100, 100 - penalty));
      return {
        ...r,
        team: {
          ...r.team,
          trustFactor,
          activeReportsCount: activeReports,
        },
      };
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
      const rawUserResponses = await prisma.scrimResponse.findMany({
        where: {
          requestId: id,
          teamId: { in: userTeamIds },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              tag: true,
              logoUrl: true,
              noShowCount: true,
              avgElo: true,
              stats: {
                select: { winRate: true, matchesPlayed: true },
              },
            },
          },
          slot: true,
        },
      });

      responses = rawUserResponses.map((r) => {
        const penalty = r.team.noShowCount * 20;
        const trustFactor = Math.max(0, Math.min(100, 100 - penalty));
        return {
          ...r,
          team: {
            ...r.team,
            trustFactor,
          },
        };
      });
    }
  }

  const teamPenalty = scrim.team.noShowCount * 20;
  const teamTrustFactor = Math.max(0, Math.min(100, 100 - teamPenalty));

  const payload = {
    success: true,
    data: {
      ...scrim,
      team: {
        ...scrim.team,
        trustFactor: teamTrustFactor,
      },
      isAuthor: Boolean(isAuthorManager),
      targetTeam,
      isTargetManager,
      responses,
    },
  };

  memoryCache.set(cacheKey, payload, 10);

  return NextResponse.json(payload);
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

  if (scrim.status === ScrimStatus.CANCELLED) {
    memoryCache.invalidate('scrims:');
    memoryCache.invalidate(`scrim:detail:${id}`);
    memoryCache.invalidate('feed:');
    return NextResponse.json({ success: true, message: 'Заявка уже отменена' });
  }

  if (scrim.status !== ScrimStatus.OPEN) {
    return NextResponse.json(
      { success: false, error: 'Нельзя отменить заявку, которая находится в статусе ' + scrim.status },
      { status: 400 }
    );
  }

  await prisma.scrimRequest.update({
    where: { id },
    data: { status: ScrimStatus.CANCELLED },
  });

  memoryCache.invalidate('scrims:');
  memoryCache.invalidate(`scrim:detail:${id}`);
  memoryCache.invalidate('feed:');

  return NextResponse.json({ success: true, message: 'Заявка успешно отменена' });
}

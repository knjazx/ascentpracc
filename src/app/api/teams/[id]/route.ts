import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { teamUpdateSchema } from '@/lib/validations/team';
import { MatchStatus, Role } from '@prisma/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      stats: true,
      managers: {
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
      },
      ratingsReceived: {
        select: {
          punctuality: true,
          sportsmanship: true,
          comment: true,
          createdAt: true,
        },
      },
      matchesAsTeamA: {
        where: { status: { in: [MatchStatus.CONFIRMED, MatchStatus.DISPUTED] } },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        include: {
          teamB: { select: { id: true, name: true, tag: true, logoUrl: true } },
          maps: true,
        },
      },
      matchesAsTeamB: {
        where: { status: { in: [MatchStatus.CONFIRMED, MatchStatus.DISPUTED] } },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        include: {
          teamA: { select: { id: true, name: true, tag: true, logoUrl: true } },
          maps: true,
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ success: false, error: 'Команда не найдена' }, { status: 404 });
  }

  // Calculate average ratings
  const ratings = team.ratingsReceived;
  let avgPunctuality = 5.0;
  let avgSportsmanship = 5.0;

  if (ratings.length > 0) {
    avgPunctuality = Number(
      (ratings.reduce((acc, r) => acc + r.punctuality, 0) / ratings.length).toFixed(1)
    );
    avgSportsmanship = Number(
      (ratings.reduce((acc, r) => acc + r.sportsmanship, 0) / ratings.length).toFixed(1)
    );
  }

  // Combine and sort recent matches
  const recentMatches = [
    ...team.matchesAsTeamA.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt,
      format: m.format,
      status: m.status,
      winnerId: m.winnerId,
      isTeamA: true,
      opponent: m.teamB,
      maps: m.maps,
    })),
    ...team.matchesAsTeamB.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt,
      format: m.format,
      status: m.status,
      winnerId: m.winnerId,
      isTeamA: false,
      opponent: m.teamA,
      maps: m.maps,
    })),
  ]
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 10);

  return NextResponse.json({
    success: true,
    data: {
      ...team,
      avgPunctuality,
      avgSportsmanship,
      ratingCount: ratings.length,
      recentMatches,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id } = params;

  // Check user permissions
  const managerRecord = await prisma.teamManager.findUnique({
    where: { teamId_userId: { teamId: id, userId: user.id } },
  });

  if (!managerRecord && user.role !== Role.ADMIN) {
    return NextResponse.json(
      { success: false, error: 'У вас нет прав на редактирование этой команды' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validated = teamUpdateSchema.parse(body);

    // If name or tag changed, verify uniqueness
    if (validated.name || validated.tag) {
      const existing = await prisma.team.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(validated.name ? [{ name: { equals: validated.name, mode: 'insensitive' as const } }] : []),
            ...(validated.tag ? [{ tag: { equals: validated.tag, mode: 'insensitive' as const } }] : []),
          ],
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Команда с таким названием или тегом уже существует' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.team.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(validated.tag ? { tag: validated.tag } : {}),
        ...(validated.description !== undefined ? { description: validated.description } : {}),
        ...(validated.avgElo !== undefined ? { avgElo: validated.avgElo } : {}),
        ...(validated.discordInvite !== undefined ? { discordInvite: validated.discordInvite } : {}),
        ...(validated.logoUrl !== undefined ? { logoUrl: validated.logoUrl } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при обновлении команды';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
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

  // Check owner or admin
  const managerRecord = await prisma.teamManager.findUnique({
    where: { teamId_userId: { teamId: id, userId: user.id } },
  });

  if ((!managerRecord || !managerRecord.isOwner) && user.role !== Role.ADMIN) {
    return NextResponse.json(
      { success: false, error: 'Только владелец или администратор может удалить команду' },
      { status: 403 }
    );
  }

  // Active matches check
  const activeMatchesCount = await prisma.match.count({
    where: {
      OR: [{ teamAId: id }, { teamBId: id }],
      status: {
        in: [
          MatchStatus.SCHEDULED,
          MatchStatus.VETO,
          MatchStatus.LIVE,
          MatchStatus.AWAITING_RESULT,
        ],
      },
    },
  });

  if (activeMatchesCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Невозможно удалить команду: найдено ${activeMatchesCount} активных матчей. Завершите или отмените их перед удалением.`,
      },
      { status: 400 }
    );
  }

  await prisma.team.delete({
    where: { id },
  });

  return NextResponse.json({ success: true, message: 'Команда успешно удалена' });
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MatchStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: teamId } = params;
  const { searchParams } = new URL(request.url);
  const opponentId = searchParams.get('opponentId');

  if (!opponentId) {
    return NextResponse.json(
      { success: false, error: 'Укажите ID команды соперника (opponentId)' },
      { status: 400 }
    );
  }

  const [team, opponent] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, tag: true, logoUrl: true } }),
    prisma.team.findUnique({ where: { id: opponentId }, select: { id: true, name: true, tag: true, logoUrl: true } }),
  ]);

  if (!team || !opponent) {
    return NextResponse.json(
      { success: false, error: 'Одна из команд не найдена' },
      { status: 404 }
    );
  }

  // Find all finished matches between the two teams
  const matches = await prisma.match.findMany({
    where: {
      status: { in: [MatchStatus.CONFIRMED, MatchStatus.DISPUTED] },
      OR: [
        { teamAId: teamId, teamBId: opponentId },
        { teamAId: opponentId, teamBId: teamId },
      ],
    },
    include: {
      maps: true,
    },
    orderBy: { scheduledAt: 'desc' },
  });

  let teamWins = 0;
  let opponentWins = 0;
  let draws = 0;

  const mapStats: Record<string, { teamWins: number; opponentWins: number }> = {};

  for (const m of matches) {
    if (m.winnerId === teamId) {
      teamWins++;
    } else if (m.winnerId === opponentId) {
      opponentWins++;
    } else {
      draws++;
    }

    for (const map of m.maps) {
      if (map.finalScoreA !== null && map.finalScoreB !== null) {
        if (!mapStats[map.map]) {
          mapStats[map.map] = { teamWins: 0, opponentWins: 0 };
        }
        const teamScore = m.teamAId === teamId ? map.finalScoreA : map.finalScoreB;
        const oppScore = m.teamAId === teamId ? map.finalScoreB : map.finalScoreA;

        if (teamScore > oppScore) {
          mapStats[map.map].teamWins++;
        } else if (oppScore > teamScore) {
          mapStats[map.map].opponentWins++;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      team,
      opponent,
      totalMatches: matches.length,
      teamWins,
      opponentWins,
      draws,
      mapStats,
      matches: matches.map((m) => ({
        id: m.id,
        scheduledAt: m.scheduledAt,
        format: m.format,
        winnerId: m.winnerId,
        maps: m.maps,
      })),
    },
  });
}

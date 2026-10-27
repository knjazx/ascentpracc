import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MatchStatus, ScrimFormat, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const teamId = searchParams.get('teamId');
    const formatParam = searchParams.get('format');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.MatchWhereInput = {};

    if (statusParam) {
      const statuses = statusParam.split(',').map((s) => s.trim()) as MatchStatus[];
      const validStatuses = statuses.filter((s) => Object.values(MatchStatus).includes(s));
      if (validStatuses.length === 1) {
        where.status = validStatuses[0];
      } else if (validStatuses.length > 1) {
        where.status = { in: validStatuses };
      }
    }

    if (formatParam && Object.values(ScrimFormat).includes(formatParam as ScrimFormat)) {
      where.format = formatParam as ScrimFormat;
    }

    if (teamId) {
      where.OR = [{ teamAId: teamId }, { teamBId: teamId }];
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { teamA: { name: { contains: search, mode: 'insensitive' } } },
            { teamA: { tag: { contains: search, mode: 'insensitive' } } },
            { teamB: { name: { contains: search, mode: 'insensitive' } } },
            { teamB: { tag: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [total, matches] = await Promise.all([
      prisma.match.count({ where }),
      prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          teamA: {
            select: {
              id: true,
              name: true,
              tag: true,
              logoUrl: true,
              discordInvite: true,
            },
          },
          teamB: {
            select: {
              id: true,
              name: true,
              tag: true,
              logoUrl: true,
              discordInvite: true,
            },
          },
          maps: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              map: true,
              finalScoreA: true,
              finalScoreB: true,
              pickedBy: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          matches,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        },
      }
    );
  } catch (err: unknown) {
    console.error('Error in GET /api/matches:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения списка матчей' },
      { status: 500 }
    );
  }
}

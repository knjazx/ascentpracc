import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role, MatchStatus } from '@prisma/client';

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const disputes = await prisma.match.findMany({
      where: {
        status: { in: [MatchStatus.DISPUTED, MatchStatus.AWAITING_RESULT] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        teamA: {
          select: { id: true, name: true, tag: true, logoUrl: true },
        },
        teamB: {
          select: { id: true, name: true, tag: true, logoUrl: true },
        },
        maps: {
          orderBy: { order: 'asc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: disputes,
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/disputes:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения споров' },
      { status: 500 }
    );
  }
}

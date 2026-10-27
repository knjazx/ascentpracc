import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role, MatchStatus, ReportStatus } from '@prisma/client';

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const [
      totalUsers,
      totalTeams,
      totalMatches,
      activeDisputes,
      pendingReports,
      liveMatches,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.team.count(),
      prisma.match.count(),
      prisma.match.count({ where: { status: MatchStatus.DISPUTED } }),
      prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      prisma.match.count({
        where: {
          status: { in: [MatchStatus.LIVE, MatchStatus.VETO, MatchStatus.AWAITING_RESULT] },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        totalTeams,
        totalMatches,
        activeDisputes,
        pendingReports,
        liveMatches,
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/stats:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения статистики админки' },
      { status: 500 }
    );
  }
}

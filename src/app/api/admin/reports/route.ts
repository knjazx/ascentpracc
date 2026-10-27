import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role, ReportStatus, ReportTargetType, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const targetType = searchParams.get('targetType');

    const where: Prisma.ReportWhereInput = {};
    if (status && Object.values(ReportStatus).includes(status as ReportStatus)) {
      where.status = status as ReportStatus;
    }
    if (targetType && Object.values(ReportTargetType).includes(targetType as ReportTargetType)) {
      where.targetType = targetType as ReportTargetType;
    }

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: {
          select: {
            id: true,
            nickname: true,
            steamId: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: reports,
    });
  } catch (err: unknown) {
    console.error('Error fetching reports:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения жалоб' },
      { status: 500 }
    );
  }
}

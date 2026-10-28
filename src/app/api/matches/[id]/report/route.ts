import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { ReportTargetType, ReportStatus } from '@prisma/client';
import { memoryCache } from '@/lib/memory-cache';

export const REPORT_CATEGORIES = {
  CHEATING: 'Подозрение в читах',
  ELO_DISCREPANCY: 'Сильно отличается AVG ELO',
  TOXICITY: 'Токсичность и оскорбления',
  NO_SHOW_QUIT: 'Неявка / Срыв матча',
  SABOTAGE: 'Неспортивное поведение / Саботаж',
} as const;

export type ReportCategoryKey = keyof typeof REPORT_CATEGORIES;

const reportSchema = z.object({
  category: z.enum([
    'CHEATING',
    'ELO_DISCREPANCY',
    'TOXICITY',
    'NO_SHOW_QUIT',
    'SABOTAGE',
  ]),
  description: z
    .string({ required_error: 'Пожалуйста, укажите детали жалобы' })
    .trim()
    .min(10, 'Пожалуйста, подробно опишите нарушение (минимум 10 символов)')
    .max(1000, 'Описание не может превышать 1000 символов'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: matchId } = params;

  try {
    const body = await request.json();
    const validated = reportSchema.parse(body);

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { include: { managers: true } },
        teamB: { include: { managers: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ success: false, error: 'Матч не найден' }, { status: 404 });
    }

    const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
    const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);

    if (!isManagerA && !isManagerB) {
      return NextResponse.json(
        { success: false, error: 'Вы не являетесь участником или менеджером команд этого матча' },
        { status: 403 }
      );
    }

    const reportingTeam = isManagerA ? match.teamA : match.teamB;
    const reportedTeam = isManagerA ? match.teamB : match.teamA;

    const categoryLabel = REPORT_CATEGORIES[validated.category];
    const fullReason = `[Категория: ${categoryLabel}] [Матч: ${matchId}] [Заявитель: [${reportingTeam.tag}] ${reportingTeam.name}]\n${validated.description}`;

    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: ReportTargetType.TEAM,
        targetId: reportedTeam.id,
        reason: fullReason,
        status: ReportStatus.PENDING,
      },
    });

    // Invalidate caches
    memoryCache.invalidate(`team:detail:${reportedTeam.id}`);
    memoryCache.invalidate('teams:');

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.id,
        message: 'Жалоба успешно передана администрации и судьям лиги на проверку.',
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error submitting match report:', err);
    return NextResponse.json({ success: false, error: 'Ошибка отправки жалобы' }, { status: 500 });
  }
}

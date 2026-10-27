import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { MatchStatus } from '@prisma/client';

const rateSchema = z.object({
  punctuality: z.number().int().min(1).max(5),
  sportsmanship: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
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
    const validated = rateSchema.parse(body);

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

    if (match.status !== MatchStatus.CONFIRMED) {
      return NextResponse.json(
        { success: false, error: 'Оставить отзыв можно только о подтвержденном матче' },
        { status: 400 }
      );
    }

    const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
    const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);

    if (!isManagerA && !isManagerB) {
      return NextResponse.json(
        { success: false, error: 'Вы не являетесь менеджером ни одной из команд матча' },
        { status: 403 }
      );
    }

    const byTeamId = isManagerA ? match.teamA.id : match.teamB.id;
    const ratedTeamId = isManagerA ? match.teamB.id : match.teamA.id;
    const byTeamTag = isManagerA ? match.teamA.tag : match.teamB.tag;
    const ratedTeamManagers = isManagerA ? match.teamB.managers : match.teamA.managers;

    const rating = await prisma.teamRating.upsert({
      where: {
        matchId_ratedTeamId_byTeamId: {
          matchId,
          ratedTeamId,
          byTeamId,
        },
      },
      update: {
        punctuality: validated.punctuality,
        sportsmanship: validated.sportsmanship,
        comment: validated.comment || null,
      },
      create: {
        matchId,
        ratedTeamId,
        byTeamId,
        punctuality: validated.punctuality,
        sportsmanship: validated.sportsmanship,
        comment: validated.comment || null,
      },
    });

    // Notify opponent managers
    for (const m of ratedTeamManagers) {
      await prisma.notification.create({
        data: {
          userId: m.userId,
          title: 'Новый отзыв о матче',
          message: `Команда [${byTeamTag}] оценила пунктуальность (${validated.punctuality}/5) и спортивное поведение (${validated.sportsmanship}/5).`,
          type: 'MATCH_RATED',
          link: `/matches/${matchId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Отзыв успешно сохранен',
      data: rating,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error in POST /api/matches/[id]/rate:', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось отправить отзыв' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role, MatchStatus } from '@prisma/client';
import { recalculateTeamStats } from '@/lib/stats';
import { isValidCS2Score } from '@/lib/validations/score';
import { z } from 'zod';

const resolveSchema = z.object({
  action: z.enum(['CONFIRM', 'CANCEL']),
  reason: z.string().min(5).max(500),
  maps: z
    .array(
      z.object({
        mapId: z.string(),
        finalScoreA: z.number().int().min(0).max(99),
        finalScoreB: z.number().int().min(0).max(99),
      })
    )
    .optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  const { matchId } = params;

  try {
    const body = await request.json();
    const validated = resolveSchema.parse(body);

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { include: { managers: true } },
        teamB: { include: { managers: true } },
        maps: true,
      },
    });

    if (!match) {
      return NextResponse.json({ success: false, error: 'Матч не найден' }, { status: 404 });
    }

    if (validated.action === 'CONFIRM') {
      if (!validated.maps || validated.maps.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Необходимо указать финальный счёт по каждой карте' },
          { status: 400 }
        );
      }

      // Check each map score against CS2 rules
      for (const m of validated.maps) {
        const check = isValidCS2Score(m.finalScoreA, m.finalScoreB);
        if (!check.valid) {
          return NextResponse.json(
            { success: false, error: `Неверный счёт карты: ${check.reason}` },
            { status: 400 }
          );
        }
      }

      let teamAWins = 0;
      let teamBWins = 0;

      await prisma.$transaction(async (tx) => {
        for (const m of validated.maps!) {
          if (m.finalScoreA > m.finalScoreB) teamAWins++;
          else if (m.finalScoreB > m.finalScoreA) teamBWins++;

          await tx.matchMap.update({
            where: { id: m.mapId },
            data: {
              finalScoreA: m.finalScoreA,
              finalScoreB: m.finalScoreB,
            },
          });
        }

        let winnerId: string | null = null;
        if (teamAWins > teamBWins) winnerId = match.teamAId;
        else if (teamBWins > teamAWins) winnerId = match.teamBId;

        await tx.match.update({
          where: { id: matchId },
          data: {
            status: MatchStatus.CONFIRMED,
            winnerId,
          },
        });

        await tx.auditLog.create({
          data: {
            matchId,
            userId: user.id,
            action: 'DISPUTE_RESOLVED_CONFIRMED',
            payload: {
              reason: validated.reason,
              scores: validated.maps,
              winnerId,
            },
          },
        });

        await tx.chatMessage.create({
          data: {
            matchId,
            system: true,
            text: `⚖ Судья лиги разрешил диспут по счёту. Итог: ${teamAWins}:${teamBWins}. Причина: ${validated.reason}`,
          },
        });

        const allManagers = [...match.teamA.managers, ...match.teamB.managers];
        for (const m of allManagers) {
          await tx.notification.create({
            data: {
              userId: m.userId,
              title: 'Диспут по матчу разрешен',
              message: `Администратор утвердил результат матча [${match.teamA.tag}] vs [${match.teamB.tag}].`,
              type: 'DISPUTE_RESOLVED',
              link: `/matches/${matchId}`,
            },
          });
        }
      });

      // Recalculate stats
      await recalculateTeamStats(match.teamAId);
      await recalculateTeamStats(match.teamBId);

      return NextResponse.json({
        success: true,
        message: 'Диспут успешно разрешен, результат матча утвержден',
      });
    } else {
      // CANCEL
      await prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: matchId },
          data: { status: MatchStatus.CANCELLED },
        });

        await tx.auditLog.create({
          data: {
            matchId,
            userId: user.id,
            action: 'DISPUTE_RESOLVED_CANCELLED',
            payload: { reason: validated.reason },
          },
        });

        await tx.chatMessage.create({
          data: {
            matchId,
            system: true,
            text: `⚖ Матч аннулирован администрацией лиги. Причина: ${validated.reason}`,
          },
        });

        const allManagers = [...match.teamA.managers, ...match.teamB.managers];
        for (const m of allManagers) {
          await tx.notification.create({
            data: {
              userId: m.userId,
              title: 'Матч аннулирован администратором',
              message: `Матч [${match.teamA.tag}] vs [${match.teamB.tag}] отменен. Причина: ${validated.reason}`,
              type: 'MATCH_CANCELLED_BY_ADMIN',
              link: `/matches/${matchId}`,
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Матч аннулирован администрацией',
      });
    }
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error resolving dispute:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка при разрешении спора' },
      { status: 500 }
    );
  }
}

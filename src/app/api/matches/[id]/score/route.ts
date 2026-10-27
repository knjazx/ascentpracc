import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { matchScoreSubmissionSchema, isValidCS2Score } from '@/lib/validations/score';
import { recalculateTeamStats } from '@/lib/stats';
import { MatchStatus, Role } from '@prisma/client';

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
    const validated = matchScoreSubmissionSchema.parse(body);

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

    const isManagerA = match.teamA.managers.some((m) => m.userId === user.id);
    const isManagerB = match.teamB.managers.some((m) => m.userId === user.id);
    const isAdmin = user.role === Role.ADMIN;

    if (!isManagerA && !isManagerB && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Недостаточно прав для ввода счёта' }, { status: 403 });
    }

    if (match.status === MatchStatus.CONFIRMED) {
      return NextResponse.json({ success: false, error: 'Результат матча уже подтвержден' }, { status: 400 });
    }

    // Validate all submitted map scores against CS2 rules (MR12 / MR3 OT)
    for (const m of validated.maps) {
      const check = isValidCS2Score(m.scoreA, m.scoreB);
      if (!check.valid) {
        return NextResponse.json(
          { success: false, error: `Ошибка в счёте карты: ${check.reason}` },
          { status: 400 }
        );
      }
    }

    const callerIsTeamA = isManagerA || (isAdmin && !isManagerB);
    const reportingTeamTag = callerIsTeamA ? match.teamA.tag : match.teamB.tag;

    // Save scores in a transaction
    await prisma.$transaction(async (tx) => {
      for (const m of validated.maps) {
        if (callerIsTeamA) {
          await tx.matchMap.update({
            where: { id: m.mapId },
            data: {
              scoreA_byA: m.scoreA,
              scoreB_byA: m.scoreB,
            },
          });
        } else {
          await tx.matchMap.update({
            where: { id: m.mapId },
            data: {
              scoreA_byB: m.scoreA,
              scoreB_byB: m.scoreB,
            },
          });
        }
      }

      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.AWAITING_RESULT,
        },
      });

      await tx.chatMessage.create({
        data: {
          matchId,
          system: true,
          text: `Команда [${reportingTeamTag}] ввела счёт матча. Ожидается подтверждение соперника.`,
        },
      });
    });

    // Check if both sides have submitted scores
    const updatedMaps = await prisma.matchMap.findMany({
      where: { matchId },
    });

    const allSubmittedByA = updatedMaps.every((m) => m.scoreA_byA !== null && m.scoreB_byA !== null);
    const allSubmittedByB = updatedMaps.every((m) => m.scoreA_byB !== null && m.scoreB_byB !== null);

    if (allSubmittedByA && allSubmittedByB) {
      // Compare both submissions
      const hasMismatch = updatedMaps.some(
        (m) => m.scoreA_byA !== m.scoreA_byB || m.scoreB_byA !== m.scoreB_byB
      );

      if (!hasMismatch) {
        // MATCH: Set CONFIRMED, calculate winner, update stats
        let winsA = 0;
        let winsB = 0;

        await prisma.$transaction(async (tx) => {
          for (const m of updatedMaps) {
            const finalA = m.scoreA_byA!;
            const finalB = m.scoreB_byA!;
            if (finalA > finalB) winsA++;
            if (finalB > finalA) winsB++;

            await tx.matchMap.update({
              where: { id: m.id },
              data: {
                finalScoreA: finalA,
                finalScoreB: finalB,
              },
            });
          }

          let winnerId: string | null = null;
          if (winsA > winsB) winnerId = match.teamAId;
          else if (winsB > winsA) winnerId = match.teamBId;

          await tx.match.update({
            where: { id: matchId },
            data: {
              status: MatchStatus.CONFIRMED,
              winnerId,
            },
          });

          const winnerText = winnerId
            ? `Победитель: [${winnerId === match.teamAId ? match.teamA.tag : match.teamB.tag}]!`
            : 'Ничья в серии 1-1!';

          await tx.chatMessage.create({
            data: {
              matchId,
              system: true,
              text: `Счета совпали! Матч успешно подтвержден (CONFIRMED). ${winnerText}`,
            },
          });
        });

        // Recalculate stats for both teams
        await Promise.all([
          recalculateTeamStats(match.teamAId),
          recalculateTeamStats(match.teamBId),
        ]);

        return NextResponse.json({
          success: true,
          status: MatchStatus.CONFIRMED,
          message: 'Счета обеих команд совпали! Матч подтвержден, статистика обновлена.',
        });
      } else {
        // MISMATCH: Set DISPUTED
        await prisma.$transaction(async (tx) => {
          await tx.match.update({
            where: { id: matchId },
            data: { status: MatchStatus.DISPUTED },
          });

          await tx.chatMessage.create({
            data: {
              matchId,
              system: true,
              text: `Внимание: данные счёта от команд не совпали! Матч переведен в статус СПОР (DISPUTED). Ожидается решение судьи.`,
            },
          });

          // Create admin report
          await tx.report.create({
            data: {
              reporterId: user.id,
              targetType: 'MATCH',
              targetId: matchId,
              reason: `Несовпадение введенных счетов командами ${match.teamA.tag} и ${match.teamB.tag}`,
              status: 'PENDING',
            },
          });
        });

        return NextResponse.json({
          success: true,
          status: MatchStatus.DISPUTED,
          message: 'Счета не совпали. Матч переведен в статус спора (DISPUTED).',
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: MatchStatus.AWAITING_RESULT,
      message: 'Счёт успешно сохранен. Ожидается ввод от второй команды.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при сохранении счёта';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

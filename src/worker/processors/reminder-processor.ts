import prisma from '@/lib/prisma';
import { MatchStatus } from '@prisma/client';
import { notifyMatchReminder } from '@/lib/discord';

export async function processMatchReminder(data: { matchId: string; timeText: string }) {
  const { matchId, timeText } = data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { managers: true } },
      teamB: { include: { managers: true } },
    },
  });

  if (!match) return;

  // Only send reminders if match is still upcoming
  if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.VETO) {
    return;
  }

  const allManagers = [...match.teamA.managers, ...match.teamB.managers];

  for (const m of allManagers) {
    await prisma.notification.create({
      data: {
        userId: m.userId,
        title: `Напоминание о матче (${timeText})`,
        message: `Матч [${match.teamA.tag}] vs [${match.teamB.tag}] (${match.format}) начнется через ${timeText}. Проверьте сервер и состав.`,
        type: 'MATCH_REMINDER',
        link: `/lobby/${match.id}`,
      },
    });
  }

  // Send Discord webhook notification
  await notifyMatchReminder({
    teamAName: match.teamA.name,
    teamATag: match.teamA.tag,
    teamBName: match.teamB.name,
    teamBTag: match.teamB.tag,
    timeText,
    matchId: match.id,
  });

  console.log(`[Worker] Sent ${timeText} reminders for match #${match.id}.`);
}

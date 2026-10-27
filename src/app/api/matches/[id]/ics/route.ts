import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: matchId } = params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        teamA: { select: { name: true, tag: true } },
        teamB: { select: { name: true, tag: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ success: false, error: 'Матч не найден' }, { status: 404 });
    }

    const startDate = new Date(match.scheduledAt);
    // Estimated match duration: BO1 = 1.5h, BO2 = 2.5h, BO3 = 3.5h
    const durationHours = match.format === 'BO1' ? 1.5 : match.format === 'BO2' ? 2.5 : 3.5;
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

    const now = new Date();
    const dtStamp = formatICSDate(now);
    const dtStart = formatICSDate(startDate);
    const dtEnd = formatICSDate(endDate);

    const serverInfo = match.serverInfo as { ip?: string; port?: number; password?: string } | null;
    const serverDetails = serverInfo?.ip
      ? `Сервер: ${serverInfo.ip}:${serverInfo.port || 27015} (Пароль: ${serverInfo.password || 'нет'})`
      : 'Данные сервера будут предоставлены в лобби матча.';

    const summary = `CS2 Scrim: [${match.teamA.tag}] vs [${match.teamB.tag}] (${match.format})`;
    const description = [
      `CS2 Практический матч: ${match.teamA.name} vs ${match.teamB.name}`,
      `Формат: ${match.format}`,
      serverDetails,
      `Лобби матча: /lobby/${match.id}`,
    ].join('\\n');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CS2 Scrim League//Match Calendar//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:match-${match.id}@cs2scrims.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'LOCATION:CS2 Private Dedicated Server',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="cs2-match-${match.id}.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: unknown) {
    console.error('Error generating ICS:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка генерации календаря' },
      { status: 500 }
    );
  }
}

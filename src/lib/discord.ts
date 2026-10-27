/**
 * Discord Webhook Notification Service
 * Sends structured rich embeds to configured Discord channels
 */

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number; // Integer decimal color (e.g. 0xf59e0b for Amber)
  fields?: DiscordEmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  thumbnail?: { url: string };
}

export async function sendDiscordWebhook(
  embed: DiscordEmbed,
  content?: string
): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    // Discord webhook not configured in environment, skip gracefully
    return false;
  }

  try {
    const payload = {
      username: 'CS2 Scrims Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/8065/8065074.png',
      content: content || undefined,
      embeds: [
        {
          ...embed,
          color: embed.color ?? 0xf59e0b, // Default Amber
          footer: embed.footer || { text: 'CS2 Scrim League • Автоматическое уведомление' },
          timestamp: embed.timestamp || new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[Discord Webhook] Failed to deliver: status ${res.status}`);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error('[Discord Webhook] Delivery error:', err);
    return false;
  }
}

/**
 * Pre-formatted event alerts
 */

export async function notifyNewScrimRequest(params: {
  teamName: string;
  teamTag: string;
  format: string;
  level?: string | null;
  serverBy: string;
  firstSlotDate: string;
  scrimId: string;
}) {
  return sendDiscordWebhook({
    title: `📢 Новый прак: [${params.teamTag}] ${params.teamName}`,
    description: `Команда создала открытую заявку на скрим по CS2.`,
    color: 0x3b82f6, // Blue
    fields: [
      { name: 'Формат', value: params.format, inline: true },
      { name: 'Уровень', value: params.level || 'Любой', inline: true },
      { name: 'Сервер', value: params.serverBy, inline: true },
      { name: 'Первый слот', value: params.firstSlotDate, inline: false },
    ],
    url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/scrims/${params.scrimId}`,
  });
}

export async function notifyMatchConfirmed(params: {
  teamAName: string;
  teamATag: string;
  teamBName: string;
  teamBTag: string;
  format: string;
  scoreA: number;
  scoreB: number;
  winnerName: string;
  matchId: string;
}) {
  return sendDiscordWebhook({
    title: `🏆 Результат матча: ${params.winnerName} одержала победу!`,
    description: `Прак между [${params.teamATag}] и [${params.teamBTag}] завершен и подтвержден.`,
    color: 0x10b981, // Emerald Green
    fields: [
      { name: 'Серия', value: `${params.format} (${params.scoreA} : ${params.scoreB})`, inline: true },
      { name: 'Победитель', value: params.winnerName, inline: true },
    ],
    url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/matches/${params.matchId}`,
  });
}

export async function notifyMatchReminder(params: {
  teamAName: string;
  teamATag: string;
  teamBName: string;
  teamBTag: string;
  timeText: string;
  matchId: string;
}) {
  return sendDiscordWebhook({
    title: `⏰ Напоминание о матче CS2 (${params.timeText})`,
    description: `Матч **[${params.teamATag}] ${params.teamAName}** vs **[${params.teamBTag}] ${params.teamBName}** начнется через ${params.timeText}! Проверьте готовность состава и сервера.`,
    color: 0xf59e0b, // Amber
    url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/lobby/${params.matchId}`,
  });
}

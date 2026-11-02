/**
 * Discord Notification Service
 * Sends structured rich embeds via Discord Webhook and Discord Bot Direct Messages (DMs)
 * Hosted directly within Next.js via Discord REST API (ASCENT HELPER)
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

// In-memory cache for resolved Discord usernames -> snowflake IDs
const discordUserCache = new Map<string, string>();

/**
 * Resolves a Discord identifier (numeric Snowflake ID or username/tag) to a numerical Discord User ID.
 * Uses official guild member search in Ascent League guild if a username is provided.
 */
export async function resolveDiscordUserId(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  // If already a numeric snowflake ID (17-20 digits)
  if (/^\d{17,20}$/.test(trimmed)) {
    return trimmed;
  }

  // Clean username (strip leading @ and legacy #0000 discriminators)
  const cleanUsername = trimmed.replace(/^@/, '').split('#')[0].trim().toLowerCase();
  if (!cleanUsername) return null;

  if (discordUserCache.has(cleanUsername)) {
    return discordUserCache.get(cleanUsername)!;
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || '1514745791179259925';

  if (!botToken) {
    return null;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(cleanUsername)}&limit=10`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    );

    if (!res.ok) {
      console.warn(`[Discord Bot] Guild member search failed: status ${res.status}`);
      return null;
    }

    const members: Array<{
      user: {
        id: string;
        username: string;
        global_name?: string | null;
      };
      nick?: string | null;
    }> = await res.json();

    if (!members || members.length === 0) {
      return null;
    }

    // Try finding exact match on username or nick or global_name
    const exact = members.find(
      (m) =>
        m.user.username.toLowerCase() === cleanUsername ||
        m.user.global_name?.toLowerCase() === cleanUsername ||
        m.nick?.toLowerCase() === cleanUsername
    );

    const resolvedId = exact ? exact.user.id : members[0].user.id;
    discordUserCache.set(cleanUsername, resolvedId);
    return resolvedId;
  } catch (err) {
    console.error('[Discord Bot] Error resolving user ID:', err);
    return null;
  }
}

/**
 * Sends a Direct Message (DM) to a Discord user from the ASCENT HELPER bot.
 */
export async function sendDiscordDirectMessage(params: {
  recipientId: string;
  embed: DiscordEmbed;
  content?: string;
}): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error('[Discord Bot DM] DISCORD_BOT_TOKEN is missing in environment!');
    return { success: false, error: 'DISCORD_BOT_TOKEN не настроен на сервере' };
  }

  try {
    // 1. Create / open DM channel with recipient
    const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: params.recipientId }),
    });

    if (!channelRes.ok) {
      const errText = await channelRes.text();
      console.warn(`[Discord Bot DM] Failed to open DM with ${params.recipientId}:`, errText);
      let errorMsg = 'Не удалось открыть ЛС с пользователем';
      if (channelRes.status === 403 || errText.includes('50007')) {
        errorMsg = 'У пользователя закрыты личные сообщения от участников сервера в Discord';
      }
      return { success: false, error: errorMsg };
    }

    const channelData = await channelRes.json();
    const dmChannelId = channelData.id;

    // 2. Deliver message with rich embed
    const messageRes = await fetch(`https://discord.com/api/v10/channels/${dmChannelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: params.content || undefined,
        embeds: [
          {
            ...params.embed,
            color: params.embed.color ?? 0x5865f2, // Discord Blurple
            footer: params.embed.footer || { text: 'ASCENT HELPER • Личное уведомление' },
            timestamp: params.embed.timestamp || new Date().toISOString(),
          },
        ],
      }),
    });

    if (!messageRes.ok) {
      const msgErr = await messageRes.text();
      console.warn(`[Discord Bot DM] Failed to send message to channel ${dmChannelId}:`, msgErr);
      return { success: false, error: 'Discord отклонил отправку сообщения в ЛС' };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('[Discord Bot DM] Error sending DM:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Внутренняя ошибка сети' };
  }
}

/**
 * Sends a message via Discord Webhook to a channel
 */
export async function sendDiscordWebhook(
  embed: DiscordEmbed,
  content?: string,
  customWebhookUrl?: string
): Promise<boolean> {
  const webhookUrl = customWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return false;
  }

  try {
    const payload = {
      username: 'ASCENT HELPER',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/8065/8065074.png',
      content: content || undefined,
      embeds: [
        {
          ...embed,
          color: embed.color ?? 0xf59e0b, // Default Amber
          footer: embed.footer || { text: 'Ascent Pracc • Автоматическое уведомление' },
          timestamp: embed.timestamp || new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err: unknown) {
    console.error('[Discord Webhook] Delivery error:', err);
    return false;
  }
}

/**
 * Pre-formatted event alerts
 */

export async function notifyScrimResponseInDM(params: {
  recipientDiscordIdOrTag: string;
  targetTeamName: string;
  respondingTeamName: string;
  respondingTeamTag: string;
  slotTimeText: string;
  message?: string | null;
  scrimId: string;
  platform?: string;
  trustScore?: number;
  avgElo?: number | null;
}): Promise<boolean> {
  const userId = await resolveDiscordUserId(params.recipientDiscordIdOrTag);
  if (!userId) {
    console.warn(`[Discord Bot DM] Could not resolve user ID for: ${params.recipientDiscordIdOrTag}`);
    return false;
  }

  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://ascentpracc.ru';
  const scrimUrl = `${siteUrl}/scrims/${params.scrimId}`;

  const fields: DiscordEmbedField[] = [
    { name: 'Время матча', value: `⏰ ${params.slotTimeText}`, inline: true },
    { name: 'Платформа', value: `🌐 ${params.platform || 'CS2 Server'}`, inline: true },
    {
      name: 'Рейтинг доверия',
      value: `🛡️ ${typeof params.trustScore === 'number' ? `${params.trustScore}%` : '100%'}`,
      inline: true,
    },
    {
      name: 'AVG ELO команды',
      value: `⭐ ${params.avgElo ? `${params.avgElo} ELO` : 'Не указан'}`,
      inline: true,
    },
  ];

  if (params.message) {
    fields.push({
      name: 'Сообщение соперника',
      value: `«${params.message}»`,
      inline: false,
    });
  }

  const result = await sendDiscordDirectMessage({
    recipientId: userId,
    embed: {
      title: `📩 Новый отклик на ваш прак!`,
      description: `Команда **[${params.respondingTeamTag}] ${params.respondingTeamName}** откликнулась на ваш прак команды **${params.targetTeamName}**.\n\nПерейдите по ссылке, чтобы принять или отклонить предложение:`,
      color: 0x10b981, // Emerald Green
      fields,
      url: scrimUrl,
      footer: { text: 'ASCENT HELPER • Оповещение о праках' },
    },
  });

  return result.success;
}

export async function notifyNewScrimRequest(params: {
  teamName: string;
  teamTag: string;
  format: string;
  level?: string | null;
  serverBy: string;
  firstSlotDate: string;
  scrimId: string;
}) {
  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
    url: `${siteUrl}/scrims/${params.scrimId}`,
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
  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return sendDiscordWebhook({
    title: `🏆 Результат матча: ${params.winnerName} одержала победу!`,
    description: `Прак между [${params.teamATag}] и [${params.teamBTag}] завершен и подтвержден.`,
    color: 0x10b981, // Emerald Green
    fields: [
      { name: 'Серия', value: `${params.format} (${params.scoreA} : ${params.scoreB})`, inline: true },
      { name: 'Победитель', value: params.winnerName, inline: true },
    ],
    url: `${siteUrl}/matches/${params.matchId}`,
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
  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return sendDiscordWebhook({
    title: `⏰ Напоминание о матче CS2 (${params.timeText})`,
    description: `Матч **[${params.teamATag}] ${params.teamAName}** vs **[${params.teamBTag}] ${params.teamBName}** начнется через ${params.timeText}! Проверьте готовность состава и сервера.`,
    color: 0xf59e0b, // Amber
    url: `${siteUrl}/lobby/${params.matchId}`,
  });
}

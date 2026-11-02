import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { scrimResponseSchema } from '@/lib/validations/scrim';
import { ScrimStatus, ResponseStatus } from '@prisma/client';
import { notifyScrimResponseInDM, sendDiscordWebhook } from '@/lib/discord';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: requestId } = params;

  try {
    const body = await request.json();
    const validated = scrimResponseSchema.parse(body);

    // 1. Verify user is manager of responding team
    const managerRecord = await prisma.teamManager.findUnique({
      where: {
        teamId_userId: {
          teamId: validated.teamId,
          userId: user.id,
        },
      },
      include: {
        team: { select: { id: true, name: true, tag: true, isPro: true } },
      },
    });

    if (!managerRecord && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Вы не управляете выбранной командой' },
        { status: 403 }
      );
    }

    const isProUser = Boolean(
      user.isPro && (!user.proExpiresAt || new Date(user.proExpiresAt).getTime() > Date.now())
    );
    const respondingTeam =
      managerRecord?.team ||
      (await prisma.team.findUnique({
        where: { id: validated.teamId },
        select: { id: true, name: true, tag: true, isPro: true, avgElo: true, noShowCount: true },
      }));
    const isProResponse = Boolean(isProUser || respondingTeam?.isPro);

    // 2. Fetch ScrimRequest
    const scrim = await prisma.scrimRequest.findUnique({
      where: { id: requestId },
      include: {
        team: {
          include: {
            managers: {
              include: {
                user: {
                  select: {
                    id: true,
                    nickname: true,
                    discordId: true,
                    discordTag: true,
                    discordWebhookUrl: true,
                    isPro: true,
                    timezone: true,
                  },
                },
              },
            },
          },
        },
        slots: true,
      },
    });

    if (!scrim) {
      return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 });
    }

    if (scrim.status !== ScrimStatus.OPEN || new Date(scrim.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Эта заявка уже закрыта или истекла' },
        { status: 400 }
      );
    }

    // 3. Cannot respond to own team
    if (scrim.teamId === validated.teamId) {
      return NextResponse.json(
        { success: false, error: 'Нельзя откликаться на заявку своей же команды' },
        { status: 400 }
      );
    }

    // 4. Blacklist check
    const isBlacklisted = await prisma.teamBlacklist.findFirst({
      where: {
        OR: [
          { teamId: scrim.teamId, blockedTeamId: validated.teamId },
          { teamId: validated.teamId, blockedTeamId: scrim.teamId },
        ],
      },
    });

    if (isBlacklisted) {
      return NextResponse.json(
        { success: false, error: 'Отклик невозможен из-за черного списка команд' },
        { status: 403 }
      );
    }

    // 5. Cannot respond twice from the same team
    const existingResponse = await prisma.scrimResponse.findFirst({
      where: {
        requestId,
        teamId: validated.teamId,
        status: { in: [ResponseStatus.PENDING, ResponseStatus.ACCEPTED] },
      },
    });

    if (existingResponse) {
      return NextResponse.json(
        { success: false, error: 'Ваша команда уже отправила отклик на эту заявку' },
        { status: 400 }
      );
    }

    // 6. Validate chosen slot or proposed time
    let slotId: string | null = null;
    let proposedAt: Date | null = null;

    if (validated.slotId) {
      const slot = scrim.slots.find((s) => s.id === validated.slotId);
      if (!slot) {
        return NextResponse.json({ success: false, error: 'Указанный слот не найден' }, { status: 400 });
      }
      slotId = slot.id;
    } else if (validated.proposedAt) {
      proposedAt = new Date(validated.proposedAt);
    }

    // 7. Create Response and notify author managers
    const created = await prisma.$transaction(async (tx) => {
      const resp = await tx.scrimResponse.create({
        data: {
          requestId,
          teamId: validated.teamId,
          slotId,
          proposedAt,
          message: validated.message || null,
          disableVertigo: Boolean(validated.disableVertigo),
          isPro: isProResponse,
          status: ResponseStatus.PENDING,
        },
        include: {
          team: {
            select: { id: true, name: true, tag: true, logoUrl: true, isPro: true },
          },
          slot: true,
        },
      });

      // Notifications for author team managers
      const proBadge = isProResponse ? ' ⭐ PRO' : '';
      for (const m of scrim.team.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: isProResponse ? '⭐ Новый PRO-отклик на прак!' : 'Новый отклик на прак!',
            message: `Команда ${respondingTeam?.name || 'Соперник'} [${respondingTeam?.tag || 'CS2'}]${proBadge} откликнулась на вашу заявку на прак.`,
            type: 'SCRIM_RESPONSE',
            link: `/scrims/${requestId}`,
          },
        });
      }

      return resp;
    });

    // Asynchronously notify managers in Discord DMs via ASCENT HELPER
    (async () => {
      try {
        let slotTimeText = 'По договоренности';
        if (slotId) {
          const chosenSlot = scrim.slots.find((s) => s.id === slotId);
          if (chosenSlot) {
            slotTimeText = new Date(chosenSlot.startsAt).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            });
          }
        } else if (proposedAt) {
          slotTimeText = `Предложено: ${proposedAt.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}`;
        }

        // Fetch responding team info (avgElo, noShowCount) and calculate trustScore
        const respondingTeam = await prisma.team.findUnique({
          where: { id: validated.teamId },
          select: {
            id: true,
            name: true,
            tag: true,
            avgElo: true,
            noShowCount: true,
          },
        });

        const activeReports = await prisma.report.count({
          where: {
            targetType: 'TEAM',
            targetId: validated.teamId,
            status: { in: ['PENDING', 'REVIEWED', 'RESOLVED'] },
          },
        });

        const penalty = ((respondingTeam?.noShowCount || 0) * 20) + (activeReports * 15);
        const trustScore = Math.max(0, Math.min(100, 100 - penalty));

        for (const m of scrim.team.managers) {
          const discordTarget = m.user.discordId || m.user.discordTag;
          if (discordTarget) {
            await notifyScrimResponseInDM({
              recipientDiscordIdOrTag: discordTarget,
              targetTeamName: scrim.team.name,
              respondingTeamName: respondingTeam?.name || managerRecord?.team.name || 'Соперник',
              respondingTeamTag: respondingTeam?.tag || managerRecord?.team.tag || 'CS2',
              slotTimeText,
              message: validated.message || null,
              scrimId: requestId,
              platform: scrim.platform || undefined,
              trustScore,
              avgElo: respondingTeam?.avgElo ?? null,
            });
          }
        }

        // Send to PRO Discord Webhook URL if configured
        const targetWebhook =
          scrim.team.discordWebhookUrl ||
          scrim.team.managers.find((m) => m.user.discordWebhookUrl)?.user.discordWebhookUrl;

        if (targetWebhook) {
          try {
            await sendDiscordWebhook(
              {
                title: isProResponse
                  ? `⭐ PRO-отклик на ваш прак! [${scrim.format}]`
                  : `⚡ Новый отклик на ваш прак! [${scrim.format}]`,
                description: `Команда **${respondingTeam?.name || 'Соперник'}** [\`${respondingTeam?.tag || 'CS2'}\`] ${isProResponse ? '⭐ *(PRO)*' : ''} откликнулась на ваш прак!`,
                color: isProResponse ? 0xf59e0b : 0x3b82f6,
                fields: [
                  { name: 'Формат', value: scrim.format, inline: true },
                  { name: 'Время', value: slotTimeText, inline: true },
                  { name: 'Платформа', value: scrim.platform || 'Cybershoke', inline: true },
                  {
                    name: 'Статус заявки',
                    value: isProResponse ? '⭐ PRO (Закреплена вверху)' : 'Обычный отклик',
                    inline: true,
                  },
                  { name: 'Сообщение соперника', value: validated.message || 'Без сообщения', inline: false },
                ],
                footer: { text: 'Ascent Pracc PRO • Уведомление в Discord' },
                timestamp: new Date().toISOString(),
              },
              `📢 **${isProResponse ? '⭐ PRO-отклик' : 'Новый отклик'} на прак от команды [${respondingTeam?.tag || 'CS2'}]!**`,
              targetWebhook
            );
          } catch (webhookErr) {
            console.error('[Discord Webhook Delivery Error]', webhookErr);
          }
        }
      } catch (dmErr) {
        console.error('[Discord Bot DM Error]', dmErr);
      }
    })();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при отправке отклика';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { resolveDiscordUserId, sendDiscordDirectMessage } from '@/lib/discord';

export async function POST(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { discordId: true, discordTag: true, nickname: true },
  });

  const discordTarget = dbUser?.discordId || dbUser?.discordTag;
  if (!discordTarget) {
    return NextResponse.json(
      {
        success: false,
        error: 'Сначала укажите и сохраните ваш Discord тег или Discord ID в настройках.',
      },
      { status: 400 }
    );
  }

  const resolvedId = await resolveDiscordUserId(discordTarget);
  if (!resolvedId) {
    return NextResponse.json(
      {
        success: false,
        error: `Бот ASCENT HELPER не смог найти пользователя "${discordTarget}" на сервере Ascent League. Проверьте правильность тега или укажите ваш точный числовой Discord ID.`,
      },
      { status: 404 }
    );
  }

  // If user had username but no discordId saved, save the resolved ID for ultra-fast future lookups
  if (!dbUser?.discordId && resolvedId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { discordId: resolvedId },
    });
  }

  const success = await sendDiscordDirectMessage({
    recipientId: resolvedId,
    embed: {
      title: '✅ Проверка связи с ASCENT HELPER',
      description: `Привет, **${dbUser?.nickname || 'боец'}**!\n\nСвязь вашего профиля на платформе **Ascent Pracc** с Discord успешно подтверждена. Теперь при каждом новом отклике на ваш прак бот будет мгновенно присылать вам уведомление с кнопкой прямо сюда в ЛС!`,
      color: 0x10b981,
      fields: [
        { name: 'Статус', value: '🟢 Активен и готов к приёму откликов', inline: true },
        { name: 'Сервер', value: 'Ascent League ・ Сs2', inline: true },
      ],
      footer: { text: 'ASCENT HELPER • Система оповещений' },
    },
  });

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Не удалось отправить сообщение в ЛС. Убедитесь, что вы состоите на официальном сервере Ascent League и у вас разрешены личные сообщения от участников сервера в настройках конфиденциальности Discord.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Тестовое сообщение успешно отправлено вам в ЛС Discord ботом ASCENT HELPER!',
  });
}

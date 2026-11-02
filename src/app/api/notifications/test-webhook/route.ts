import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendDiscordWebhook } from '@/lib/discord';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const isPro = Boolean(
    user.isPro && (!user.proExpiresAt || new Date(user.proExpiresAt).getTime() > Date.now())
  );
  if (!isPro) {
    return NextResponse.json(
      { success: false, error: 'Функция доступна только для пользователей с подпиской PRO' },
      { status: 403 }
    );
  }

  try {
    const { webhookUrl } = await request.json();
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'Укажите URL Discord Webhook' }, { status: 400 });
    }

    if (!/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(webhookUrl.trim())) {
      return NextResponse.json(
        { success: false, error: 'Неверный формат Discord Webhook URL' },
        { status: 400 }
      );
    }

    const success = await sendDiscordWebhook(
      {
        title: '🎉 Тестовое уведомление Ascent Pracc PRO',
        description: `Webhook успешно подключен и готов к работе для аккаунта **${user.nickname}**!`,
        color: 0x10b981, // Emerald Green
        fields: [
          { name: 'Статус', value: '✅ Активен', inline: true },
          { name: 'Тип уведомлений', value: 'Отклики на праки и вызовы', inline: true },
        ],
        footer: { text: 'Ascent Pracc PRO' },
        timestamp: new Date().toISOString(),
      },
      '🔔 **Тест подключения Discord Webhook прошел успешно!**',
      webhookUrl.trim()
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Не удалось отправить сообщение в Discord. Проверьте правильность Webhook URL.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Тестовое сообщение успешно отправлено в ваш Discord!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка отправки тестового уведомления';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

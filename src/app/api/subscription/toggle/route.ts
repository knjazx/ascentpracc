import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  // If user has an active PRO subscription, it CANNOT be cancelled before expiration
  const isProActive = Boolean(
    user.isPro && (!user.proExpiresAt || new Date(user.proExpiresAt).getTime() > Date.now())
  );

  if (isProActive) {
    const formattedExpiry = user.proExpiresAt
      ? new Date(user.proExpiresAt).toLocaleDateString('ru-RU')
      : 'бессрочно';
    return NextResponse.json(
      {
        success: false,
        error: `Подписка PRO активна до ${formattedExpiry}. Досрочная отмена подписки не предусмотрена.`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Активация подписки PRO выполняется по кодам активации в разделе подписки.',
    },
    { status: 400 }
  );
}

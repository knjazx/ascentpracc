import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchSteamUserProfile } from '@/lib/steam';
import { memoryCache } from '@/lib/memory-cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const steamApiKey = process.env.STEAM_API_KEY;
    const { nickname, avatarUrl } = await fetchSteamUserProfile(user.steamId, steamApiKey);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname,
        avatarUrl,
      },
    });

    // Invalidate cached session
    memoryCache.invalidate(`user:session:${user.id}`);
    memoryCache.invalidate(`user:me:${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Профиль успешно синхронизирован со Steam!',
      data: {
        nickname: updatedUser.nickname,
        avatarUrl: updatedUser.avatarUrl,
      },
    });
  } catch (err: unknown) {
    console.error('[Steam Sync Error]', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось получить актуальные данные из Steam' },
      { status: 500 }
    );
  }
}

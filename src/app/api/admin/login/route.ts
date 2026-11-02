import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { memoryCache } from '@/lib/memory-cache';

export const dynamic = 'force-dynamic';

export const ADMIN_COOKIE_NAME = 'ascent_admin_token';
const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username || '').trim();
    const password = (body.password || '').trim();

    if (username.toLowerCase() !== 'knjazx' || password !== '20102019') {
      return NextResponse.json(
        { success: false, error: 'Неверный логин или пароль администратора' },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
    const key = new TextEncoder().encode(secret);

    // Sign admin token for 7 days
    const token = await new SignJWT({
      isAdmin: true,
      username: 'knjazx',
      role: 'ADMIN',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(key);

    // If current user is logged in via Steam, ensure role = ADMIN in database
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.steamId) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data: { role: 'ADMIN' },
      });
      memoryCache.invalidate(`user:session:${currentUser.id}`);
      memoryCache.invalidate(`user:session:${currentUser.steamId}`);
    }

    const cookieStore = cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return NextResponse.json({
      success: true,
      message: 'Успешная авторизация в панели администратора',
      user: { username: 'knjazx', role: 'ADMIN' },
    });
  } catch (err: unknown) {
    console.error('[Admin Login Error]', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера при авторизации' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  sanitizeNextUrl,
  getRequestBaseUrl,
  createSafeRedirectUrl,
} from '@/lib/auth';
import { signUserToken } from '@/lib/jwt';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get('role')?.toUpperCase();
  const rawNext = searchParams.get('next');
  const cleanNext = sanitizeNextUrl(rawNext);

  const isAdmin = roleParam === 'ADMIN';
  const steamId = isAdmin ? '76561198000000001' : '76561198000000002';
  const nickname = isAdmin ? 'Ascent Admin' : 'Ascent Captain';
  const avatarUrl = isAdmin
    ? 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
    : 'https://avatars.steamstatic.com/c562e84c980998f86f7e85c7b39f1c7d2c388bc5_full.jpg';

  const user = await prisma.user.upsert({
    where: { steamId },
    update: {
      role: isAdmin ? Role.ADMIN : Role.USER,
      nickname,
      avatarUrl,
    },
    create: {
      steamId,
      nickname,
      avatarUrl,
      role: isAdmin ? Role.ADMIN : Role.USER,
      onboarded: true,
      timezone: 'Europe/Kyiv',
    },
  });

  const token = await signUserToken({
    userId: user.id,
    steamId: user.steamId,
    role: user.role,
    banned: user.banned,
    onboarded: user.onboarded,
  });

  const redirectUrl = createSafeRedirectUrl(cleanNext, request);
  const response = NextResponse.redirect(redirectUrl);

  const baseUrl = getRequestBaseUrl(request);
  const isHttps = baseUrl.startsWith('https://');

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

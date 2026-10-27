import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  NONCE_COOKIE_NAME,
  isSteamIdAdmin,
  sanitizeNextUrl,
} from '@/lib/auth';
import { signUserToken } from '@/lib/jwt';
import { rateLimit } from '@/lib/rate-limit';
import { fetchSteamUserProfile } from '@/lib/steam';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // 1. Rate limiting by IP
  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
  const { success: allowed } = await rateLimit(`steam-callback:${ip}`, 15, 60);
  if (!allowed) {
    return NextResponse.redirect(new URL('/login?error=rate_limited', request.url));
  }

  // 2. Check for user cancellation
  if (searchParams.get('openid.mode') === 'cancel') {
    return NextResponse.redirect(new URL('/login?error=cancelled', request.url));
  }

  // 3. Verify Nonce from cookie against query param
  const cookieNonce = request.cookies.get(NONCE_COOKIE_NAME)?.value;
  const queryNonce = searchParams.get('nonce');
  const cleanNext = sanitizeNextUrl(searchParams.get('next'));

  if (!cookieNonce || !queryNonce || cookieNonce !== queryNonce) {
    return NextResponse.redirect(new URL('/login?error=invalid_nonce', request.url));
  }

  // 4. Validate return_to parameter
  const returnTo = searchParams.get('openid.return_to');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  if (!returnTo || !returnTo.startsWith(baseUrl)) {
    return NextResponse.redirect(new URL('/login?error=invalid_return_to', request.url));
  }

  // 5. OpenID 2.0 Server-to-Server signature verification (check_authentication)
  try {
    const verificationParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key.startsWith('openid.')) {
        verificationParams.set(key, value);
      }
    });
    verificationParams.set('openid.mode', 'check_authentication');

    const verifyResponse = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verificationParams.toString(),
    });

    const verifyText = await verifyResponse.text();
    if (!verifyText.includes('is_valid:true')) {
      console.error('[Steam Auth] Signature verification failed:', verifyText);
      return NextResponse.redirect(new URL('/login?error=signature_failed', request.url));
    }
  } catch (err) {
    console.error('[Steam Auth] Verification network error:', err);
    return NextResponse.redirect(new URL('/login?error=steam_unavailable', request.url));
  }

  // 6. Extract 64-bit SteamID from claimed_id
  const claimedId = searchParams.get('openid.claimed_id') || '';
  const steamIdMatch = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!steamIdMatch || !steamIdMatch[1]) {
    return NextResponse.redirect(new URL('/login?error=invalid_steam_id', request.url));
  }
  const steamId = steamIdMatch[1];

  // 7. Fetch Steam Player Summary (Name & Avatar)
  const steamApiKey = process.env.STEAM_API_KEY;
  const { nickname, avatarUrl } = await fetchSteamUserProfile(steamId, steamApiKey);

  // 8. Upsert user in Database
  const isAdmin = isSteamIdAdmin(steamId);

  const user = await prisma.user.upsert({
    where: { steamId },
    update: {
      nickname,
      avatarUrl,
      ...(isAdmin ? { role: Role.ADMIN } : {}),
    },
    create: {
      steamId,
      nickname,
      avatarUrl,
      role: isAdmin ? Role.ADMIN : Role.USER,
      onboarded: false,
      timezone: 'SYSTEM',
    },
  });

  // 9. Check if user is banned
  if (user.banned) {
    const bannedResponse = NextResponse.redirect(new URL('/banned', request.url));
    bannedResponse.cookies.delete(NONCE_COOKIE_NAME);
    return bannedResponse;
  }

  // 10. Generate 30-day JWT session token
  const token = await signUserToken({
    userId: user.id,
    steamId: user.steamId,
    role: user.role,
    banned: user.banned,
    onboarded: user.onboarded,
  });

  // 11. Determine redirect target (onboarding if not finished, else cleanNext)
  const redirectTarget = !user.onboarded
    ? new URL(`/onboarding?next=${encodeURIComponent(cleanNext)}`, request.url)
    : new URL(cleanNext, request.url);

  const response = NextResponse.redirect(redirectTarget);

  // Set httpOnly session cookie
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  // Clear one-time nonce cookie
  response.cookies.delete(NONCE_COOKIE_NAME);

  return response;
}

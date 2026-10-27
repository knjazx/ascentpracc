import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_MAX_AGE,
  NONCE_COOKIE_NAME,
  isSteamIdAdmin,
  sanitizeNextUrl,
  getRequestBaseUrl,
  createSafeRedirectUrl,
} from '@/lib/auth';
import { signUserToken } from '@/lib/jwt';
import { rateLimit } from '@/lib/rate-limit';
import { fetchSteamUserProfile } from '@/lib/steam';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  console.log('[Steam Auth Callback] Received callback with params:', {
    mode: searchParams.get('openid.mode'),
    claimedId: searchParams.get('openid.claimed_id'),
    hasNonce: Boolean(searchParams.get('nonce')),
  });

  // 1. Rate limiting by IP
  const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
  try {
    const { success: allowed } = await rateLimit(`steam-callback:${ip}`, 30, 60);
    if (!allowed) {
      console.warn(`[Steam Auth] Rate limited IP: ${ip}`);
      return NextResponse.redirect(createSafeRedirectUrl('/login?error=rate_limited', request));
    }
  } catch (err) {
    console.warn('[Steam Auth] Rate limiter error ignored:', err);
  }

  // 2. Check for user cancellation
  if (searchParams.get('openid.mode') === 'cancel') {
    return NextResponse.redirect(createSafeRedirectUrl('/login?error=cancelled', request));
  }

  // 3. Verify Nonce from cookie against query param
  const cookieNonce = request.cookies.get(NONCE_COOKIE_NAME)?.value;
  const queryNonce = searchParams.get('nonce');
  const cleanNext = sanitizeNextUrl(searchParams.get('next'));

  if (cookieNonce && queryNonce && cookieNonce !== queryNonce) {
    console.warn('[Steam Auth] Nonce mismatch:', { cookieNonce, queryNonce });
    return NextResponse.redirect(createSafeRedirectUrl('/login?error=invalid_nonce', request));
  }

  // 4. Validate return_to parameter
  const returnTo = searchParams.get('openid.return_to');
  if (returnTo) {
    try {
      const returnUrl = new URL(returnTo);
      if (!returnUrl.pathname.endsWith('/api/auth/steam/callback')) {
        console.error('[Steam Auth] Invalid return_to pathname:', returnUrl.pathname);
        return NextResponse.redirect(createSafeRedirectUrl('/login?error=invalid_return_to', request));
      }
    } catch {
      console.error('[Steam Auth] Malformed return_to URL:', returnTo);
      return NextResponse.redirect(createSafeRedirectUrl('/login?error=invalid_return_to', request));
    }
  }

  // 5. OpenID 2.0 Server-to-Server signature verification (check_authentication)
  try {
    const verificationParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      verificationParams.set(key, value);
    });
    verificationParams.set('openid.mode', 'check_authentication');

    const verifyResponse = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: verificationParams.toString(),
    });

    const verifyText = await verifyResponse.text();
    if (!verifyText.includes('is_valid:true')) {
      console.error('[Steam Auth] Signature verification failed. Steam response:', verifyText);
      return NextResponse.redirect(createSafeRedirectUrl('/login?error=signature_failed', request));
    }
  } catch (err) {
    console.error('[Steam Auth] Verification network error:', err);
    return NextResponse.redirect(createSafeRedirectUrl('/login?error=steam_unavailable', request));
  }

  // 6. Extract 64-bit SteamID from claimed_id
  const claimedId = searchParams.get('openid.claimed_id') || '';
  const steamIdMatch = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17,25})$/);
  if (!steamIdMatch || !steamIdMatch[1]) {
    console.error('[Steam Auth] Could not extract SteamID from claimed_id:', claimedId);
    return NextResponse.redirect(createSafeRedirectUrl('/login?error=invalid_steam_id', request));
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
    const bannedResponse = NextResponse.redirect(createSafeRedirectUrl('/banned', request));
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
  const redirectPath = !user.onboarded
    ? `/onboarding?next=${encodeURIComponent(cleanNext)}`
    : cleanNext;

  const redirectTarget = createSafeRedirectUrl(redirectPath, request);

  console.log(`[Steam Auth] Success! User logged in: ${user.nickname} (${user.steamId}) -> ${redirectTarget.toString()}`);

  const response = NextResponse.redirect(redirectTarget);
  const baseUrl = getRequestBaseUrl(request);
  const isHttps = baseUrl.startsWith('https://');

  // Set httpOnly session cookie
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  // Clear one-time nonce cookie
  response.cookies.delete(NONCE_COOKIE_NAME);

  return response;
}

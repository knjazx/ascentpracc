import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { NONCE_COOKIE_NAME, NONCE_COOKIE_MAX_AGE, sanitizeNextUrl } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNext = searchParams.get('next');
  const cleanNext = sanitizeNextUrl(rawNext);

  // Generate cryptographically secure nonce
  const nonce = crypto.randomUUID();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const returnTo = new URL('/api/auth/steam/callback', baseUrl);
  returnTo.searchParams.set('nonce', nonce);
  returnTo.searchParams.set('next', cleanNext);

  const steamOpenIdUrl = new URL('https://steamcommunity.com/openid/login');
  steamOpenIdUrl.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
  steamOpenIdUrl.searchParams.set('openid.mode', 'checkid_setup');
  steamOpenIdUrl.searchParams.set('openid.return_to', returnTo.toString());
  steamOpenIdUrl.searchParams.set('openid.realm', baseUrl);
  steamOpenIdUrl.searchParams.set('openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select');
  steamOpenIdUrl.searchParams.set('openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select');

  const response = NextResponse.redirect(steamOpenIdUrl.toString());

  // Store nonce in short-lived httpOnly cookie
  response.cookies.set(NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: NONCE_COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

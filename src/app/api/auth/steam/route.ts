import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { NONCE_COOKIE_NAME, NONCE_COOKIE_MAX_AGE, sanitizeNextUrl, getRequestBaseUrl } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNext = searchParams.get('next');
  const cleanNext = sanitizeNextUrl(rawNext);

  // Generate cryptographically secure nonce
  const nonce = crypto.randomUUID();

  // Dynamically resolve base URL to match where user actually accessed the site
  const baseUrl = getRequestBaseUrl(request);
  const returnTo = new URL('/api/auth/steam/callback', baseUrl);
  returnTo.searchParams.set('nonce', nonce);
  returnTo.searchParams.set('next', cleanNext);

  // OpenID 2.0 specification requires realm to end with a trailing slash
  const realm = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  const steamOpenIdUrl = new URL('https://steamcommunity.com/openid/login');
  steamOpenIdUrl.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
  steamOpenIdUrl.searchParams.set('openid.mode', 'checkid_setup');
  steamOpenIdUrl.searchParams.set('openid.return_to', returnTo.toString());
  steamOpenIdUrl.searchParams.set('openid.realm', realm);
  steamOpenIdUrl.searchParams.set('openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select');
  steamOpenIdUrl.searchParams.set('openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select');

  console.log('[Steam Auth] Initiating login redirect:', {
    baseUrl,
    realm,
    returnTo: returnTo.toString(),
  });

  const response = NextResponse.redirect(steamOpenIdUrl.toString());

  const isHttps = baseUrl.startsWith('https://');

  // Store nonce in short-lived httpOnly cookie
  response.cookies.set(NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: NONCE_COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

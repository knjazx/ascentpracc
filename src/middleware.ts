import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';
const AUTH_COOKIE_NAME = 'cs2_session';

interface TokenPayload {
  userId: string;
  steamId: string;
  role: string;
  banned: boolean;
  onboarded: boolean;
}

function getSafeRedirectUrl(targetPath: string, request: NextRequest): URL {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost && !forwardedHost.includes('0.0.0.0')) {
    const proto = (forwardedProto || 'https').split(',')[0].trim();
    return new URL(targetPath, `${proto}://${forwardedHost.split(',')[0].trim()}`);
  }

  const host = request.headers.get('host');
  if (host && !host.includes('0.0.0.0')) {
    const proto = forwardedProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
    return new URL(targetPath, `${proto}://${host}`);
  }

  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('0.0.0.0')) {
    return new URL(targetPath, process.env.NEXT_PUBLIC_APP_URL);
  }

  const origin = request.nextUrl.origin.replace('0.0.0.0', 'localhost');
  return new URL(targetPath, origin);
}

async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  const primarySecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const primaryKey = new TextEncoder().encode(primarySecret);

  try {
    const { payload } = await jwtVerify(token, primaryKey, { algorithms: ['HS256'] });
    return {
      userId: payload.userId as string,
      steamId: payload.steamId as string,
      role: payload.role as string,
      banned: Boolean(payload.banned),
      onboarded: Boolean(payload.onboarded),
    };
  } catch {
    // If primary secret verification fails and a custom secret was configured, try default fallback
    if (process.env.JWT_SECRET && process.env.JWT_SECRET !== DEFAULT_JWT_SECRET) {
      try {
        const fallbackKey = new TextEncoder().encode(DEFAULT_JWT_SECRET);
        const { payload } = await jwtVerify(token, fallbackKey, { algorithms: ['HS256'] });
        return {
          userId: payload.userId as string,
          steamId: payload.steamId as string,
          role: payload.role as string,
          banned: Boolean(payload.banned),
          onboarded: Boolean(payload.onboarded),
        };
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, api routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/maps') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let session: TokenPayload | null = null;

  if (token) {
    session = await verifySessionToken(token);
  }

  // 1. If banned, enforce /banned page
  if (session?.banned && pathname !== '/banned') {
    return NextResponse.redirect(getSafeRedirectUrl('/banned', request));
  }

  // 2. Already logged in accessing /login
  if (session && !session.banned && pathname === '/login') {
    return NextResponse.redirect(getSafeRedirectUrl('/', request));
  }

  // 3. User logged in but not onboarded
  if (session && !session.banned && !session.onboarded && pathname !== '/onboarding' && pathname !== '/banned') {
    const onboardingUrl = getSafeRedirectUrl('/onboarding', request);
    if (pathname !== '/') {
      onboardingUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(onboardingUrl);
  }

  // 4. User already onboarded attempting to visit /onboarding
  if (session && session.onboarded && pathname === '/onboarding') {
    return NextResponse.redirect(getSafeRedirectUrl('/', request));
  }

  // 5. Protected routes requiring authentication
  const protectedRoutes = [
    '/onboarding',
    '/settings',
    '/scrims/new',
    '/teams/new',
    '/lobby',
    '/admin',
  ];

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route)) || pathname.endsWith('/edit');

  if (isProtected && !session) {
    const loginUrl = getSafeRedirectUrl('/login', request);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Admin routes check
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.redirect(getSafeRedirectUrl('/', request));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

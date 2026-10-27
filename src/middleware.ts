import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';
const key = new TextEncoder().encode(JWT_SECRET);
const AUTH_COOKIE_NAME = 'cs2_session';

interface TokenPayload {
  userId: string;
  steamId: string;
  role: string;
  banned: boolean;
  onboarded: boolean;
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
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      session = {
        userId: payload.userId as string,
        steamId: payload.steamId as string,
        role: payload.role as string,
        banned: Boolean(payload.banned),
        onboarded: Boolean(payload.onboarded),
      };
    } catch {
      session = null;
    }
  }

  // 1. If banned, enforce /banned page
  if (session?.banned && pathname !== '/banned') {
    return NextResponse.redirect(new URL('/banned', request.url));
  }

  // 2. Already logged in accessing /login
  if (session && !session.banned && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. User logged in but not onboarded
  if (session && !session.banned && !session.onboarded && pathname !== '/onboarding' && pathname !== '/banned') {
    const onboardingUrl = new URL('/onboarding', request.url);
    if (pathname !== '/') {
      onboardingUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(onboardingUrl);
  }

  // 4. User already onboarded attempting to visit /onboarding
  if (session && session.onboarded && pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/', request.url));
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
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Admin routes check
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

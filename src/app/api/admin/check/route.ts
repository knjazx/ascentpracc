import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ADMIN_COOKIE_NAME = 'ascent_admin_token';
const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';

export async function GET() {
  // 1. Check Steam session role
  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.role === Role.ADMIN) {
    return NextResponse.json({
      success: true,
      isAdmin: true,
      username: currentUser.nickname,
    });
  }

  // 2. Check admin cookie
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
      const key = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (payload && payload.isAdmin) {
        return NextResponse.json({
          success: true,
          isAdmin: true,
          username: (payload.username as string) || 'knjazx',
        });
      }
    } catch {
      // Invalid/expired token
    }
  }

  return NextResponse.json({
    success: true,
    isAdmin: false,
    username: null,
  });
}

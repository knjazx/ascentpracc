import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';

const ADMIN_COOKIE_NAME = 'ascent_admin_token';
const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_cs2_scrim_league_at_least_32_chars_long';

async function verifyAdmin(): Promise<boolean> {
  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.role === Role.ADMIN) return true;

  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
      const key = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (payload && payload.isAdmin) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const updated = await prisma.activationCode.update({
      where: { id },
      data: {
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка обновления кода';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  const { id } = params;

  try {
    await prisma.activationCode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Код удален' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка удаления кода';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

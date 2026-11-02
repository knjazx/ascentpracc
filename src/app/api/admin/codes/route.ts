import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';
import crypto from 'crypto';

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

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const codes = await prisma.activationCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        activations: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatarUrl: true,
                steamId: true,
              },
            },
          },
          orderBy: { activatedAt: 'desc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: codes.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
        activations: c.activations.map((a) => ({
          id: a.id,
          userId: a.userId,
          user: a.user,
          activatedAt: a.activatedAt.toISOString(),
        })),
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка загрузки кодов';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const durationDays = Number(body.durationDays) || 30;
    const maxUses = Math.max(1, Number(body.maxUses) || 1);
    const description = body.description ? String(body.description).trim() : null;
    const expiresInDays = body.expiresInDays ? Number(body.expiresInDays) : null;

    let codeString = body.code ? String(body.code).trim().toUpperCase() : '';

    if (!codeString) {
      // Auto-generate code: PRO-XXXX-XXXX
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      codeString = `PRO-${part1}-${part2}`;
    }

    // Check if code already exists
    const existing = await prisma.activationCode.findUnique({
      where: { code: codeString },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Код с таким названием уже существует. Укажите другой или сгенерируйте автоматически.' },
        { status: 400 }
      );
    }

    const expiresAt = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const created = await prisma.activationCode.create({
      data: {
        code: codeString,
        description,
        durationDays,
        maxUses,
        expiresAt,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      },
      message: `Код ${created.code} успешно создан!`,
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка при создании кода';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

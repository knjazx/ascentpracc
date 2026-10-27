import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const bannedParam = searchParams.get('banned');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { nickname: { contains: search, mode: 'insensitive' } },
        { steamId: { contains: search } },
      ];
    }

    if (bannedParam === 'true') {
      where.banned = true;
    } else if (bannedParam === 'false') {
      where.banned = false;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          teams: {
            include: {
              team: {
                select: { id: true, name: true, tag: true },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/users:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения пользователей' },
      { status: 500 }
    );
  }
}

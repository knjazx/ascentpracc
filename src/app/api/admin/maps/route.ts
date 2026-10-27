import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@prisma/client';
import { z } from 'zod';

const mapSchema = z.object({
  map: z.string().min(2).max(50),
  displayName: z.string().min(2).max(50),
  active: z.boolean().default(true),
  imageUrl: z.string().url().optional().nullable(),
});

const toggleSchema = z.object({
  id: z.string(),
  active: z.boolean(),
});

export async function GET(_request: NextRequest) {
  try {
    const maps = await prisma.mapPool.findMany({
      orderBy: { displayName: 'asc' },
    });
    return NextResponse.json({ success: true, data: maps });
  } catch (err: unknown) {
    console.error('Error fetching map pool:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения пула карт' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, active } = toggleSchema.parse(body);

    const updated = await prisma.mapPool.update({
      where: { id },
      data: { active },
    });

    return NextResponse.json({
      success: true,
      message: `Карта ${updated.displayName} ${active ? 'включена в пул' : 'исключена из пула'}`,
      data: updated,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error toggling map pool:', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось обновить статус карты' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validated = mapSchema.parse(body);

    const created = await prisma.mapPool.create({
      data: {
        map: validated.map.toLowerCase(),
        displayName: validated.displayName,
        active: validated.active,
        imageUrl: validated.imageUrl || null,
        defaultPool: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Карта ${created.displayName} добавлена в список`,
      data: created,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('Error creating map:', err);
    return NextResponse.json(
      { success: false, error: 'Не удалось добавить карту' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, toSafeUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { memoryCache } from '@/lib/memory-cache';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rawCode = body.code;
    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json({ success: false, error: 'Введите код активации' }, { status: 400 });
    }

    const cleanCode = rawCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      return NextResponse.json({ success: false, error: 'Некорректный формат кода' }, { status: 400 });
    }

    const activationCode = await prisma.activationCode.findUnique({
      where: { code: cleanCode },
    });

    if (!activationCode) {
      return NextResponse.json(
        { success: false, error: 'Код активации не найден. Проверьте правильность ввода.' },
        { status: 404 }
      );
    }

    if (!activationCode.isActive) {
      return NextResponse.json(
        { success: false, error: 'Этот код активации деактивирован администратором.' },
        { status: 400 }
      );
    }

    if (activationCode.expiresAt && new Date(activationCode.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Срок действия этого промокода истек.' },
        { status: 400 }
      );
    }

    if (activationCode.usedCount >= activationCode.maxUses) {
      return NextResponse.json(
        { success: false, error: 'Лимит активаций этого кода исчерпан.' },
        { status: 400 }
      );
    }

    // Check if user has already activated this specific code
    const alreadyActivated = await prisma.codeActivation.findUnique({
      where: {
        codeId_userId: {
          codeId: activationCode.id,
          userId: user.id,
        },
      },
    });

    if (alreadyActivated) {
      return NextResponse.json(
        { success: false, error: 'Вы уже активировали этот промокод ранее.' },
        { status: 400 }
      );
    }

    // Calculate new expiration date (stacks if already active)
    const now = Date.now();
    let currentExpiry = now;
    if (user.isPro && user.proExpiresAt) {
      const existingTime = new Date(user.proExpiresAt).getTime();
      if (existingTime > now) {
        currentExpiry = existingTime;
      }
    }

    const durationMs = activationCode.durationDays * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(currentExpiry + durationMs);

    // Apply activation in a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Record user activation
      await tx.codeActivation.create({
        data: {
          codeId: activationCode.id,
          userId: user.id,
        },
      });

      // 2. Increment used count
      await tx.activationCode.update({
        where: { id: activationCode.id },
        data: {
          usedCount: { increment: 1 },
        },
      });

      // 3. Update user PRO status and expiry
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          isPro: true,
          proExpiresAt: newExpiresAt,
        },
      });

      // 4. Update managed teams where user is owner
      const managedTeams = await tx.teamManager.findMany({
        where: { userId: user.id, isOwner: true },
        select: { teamId: true },
      });

      for (const t of managedTeams) {
        await tx.team.update({
          where: { id: t.teamId },
          data: { isPro: true },
        });
      }

      return u;
    });

    memoryCache.invalidate(`user:session:${user.id}`);
    memoryCache.invalidate(`user:me:${user.id}`);

    const formattedDate = newExpiresAt.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return NextResponse.json({
      success: true,
      message: `🎉 Код успешно активирован! PRO подписка на ${activationCode.durationDays} дн. активна до ${formattedDate}.`,
      data: toSafeUser(updatedUser),
      durationDays: activationCode.durationDays,
      proExpiresAt: newExpiresAt.toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка при активации кода';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

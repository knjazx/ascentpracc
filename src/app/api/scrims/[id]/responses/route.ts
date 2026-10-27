import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { scrimResponseSchema } from '@/lib/validations/scrim';
import { ScrimStatus, ResponseStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
  }

  const { id: requestId } = params;

  try {
    const body = await request.json();
    const validated = scrimResponseSchema.parse(body);

    // 1. Verify user is manager of responding team
    const managerRecord = await prisma.teamManager.findUnique({
      where: {
        teamId_userId: {
          teamId: validated.teamId,
          userId: user.id,
        },
      },
      include: {
        team: { select: { id: true, name: true, tag: true } },
      },
    });

    if (!managerRecord && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Вы не управляете выбранной командой' },
        { status: 403 }
      );
    }

    // 2. Fetch ScrimRequest
    const scrim = await prisma.scrimRequest.findUnique({
      where: { id: requestId },
      include: {
        team: {
          include: {
            managers: true,
          },
        },
        slots: true,
      },
    });

    if (!scrim) {
      return NextResponse.json({ success: false, error: 'Заявка не найдена' }, { status: 404 });
    }

    if (scrim.status !== ScrimStatus.OPEN || new Date(scrim.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'Эта заявка уже закрыта или истекла' },
        { status: 400 }
      );
    }

    // 3. Cannot respond to own team
    if (scrim.teamId === validated.teamId) {
      return NextResponse.json(
        { success: false, error: 'Нельзя откликаться на заявку своей же команды' },
        { status: 400 }
      );
    }

    // 4. Blacklist check
    const isBlacklisted = await prisma.teamBlacklist.findFirst({
      where: {
        OR: [
          { teamId: scrim.teamId, blockedTeamId: validated.teamId },
          { teamId: validated.teamId, blockedTeamId: scrim.teamId },
        ],
      },
    });

    if (isBlacklisted) {
      return NextResponse.json(
        { success: false, error: 'Отклик невозможен из-за черного списка команд' },
        { status: 403 }
      );
    }

    // 5. Cannot respond twice from the same team
    const existingResponse = await prisma.scrimResponse.findFirst({
      where: {
        requestId,
        teamId: validated.teamId,
        status: { in: [ResponseStatus.PENDING, ResponseStatus.ACCEPTED] },
      },
    });

    if (existingResponse) {
      return NextResponse.json(
        { success: false, error: 'Ваша команда уже отправила отклик на эту заявку' },
        { status: 400 }
      );
    }

    // 6. Validate chosen slot or proposed time
    let slotId: string | null = null;
    let proposedAt: Date | null = null;

    if (validated.slotId) {
      const slot = scrim.slots.find((s) => s.id === validated.slotId);
      if (!slot) {
        return NextResponse.json({ success: false, error: 'Указанный слот не найден' }, { status: 400 });
      }
      slotId = slot.id;
    } else if (validated.proposedAt) {
      proposedAt = new Date(validated.proposedAt);
    }

    // 7. Create Response and notify author managers
    const created = await prisma.$transaction(async (tx) => {
      const resp = await tx.scrimResponse.create({
        data: {
          requestId,
          teamId: validated.teamId,
          slotId,
          proposedAt,
          message: validated.message || null,
          status: ResponseStatus.PENDING,
        },
        include: {
          team: {
            select: { id: true, name: true, tag: true, logoUrl: true },
          },
          slot: true,
        },
      });

      // Notifications for author team managers
      for (const m of scrim.team.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: 'Новый отклик на прак!',
            message: `Команда ${managerRecord?.team.name} [${managerRecord?.team.tag}] откликнулась на вашу заявку на прак.`,
            type: 'SCRIM_RESPONSE',
            link: `/scrims/${requestId}`,
          },
        });
      }

      return resp;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка при отправке отклика';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

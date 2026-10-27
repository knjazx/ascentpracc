import prisma from '@/lib/prisma';
import { ScrimStatus, ResponseStatus } from '@prisma/client';

export async function processScrimExpirations(): Promise<{ expiredCount: number }> {
  const now = new Date();

  // Find all open scrim requests that have expired
  const expiredScrims = await prisma.scrimRequest.findMany({
    where: {
      status: ScrimStatus.OPEN,
      expiresAt: { lte: now },
    },
    include: {
      team: {
        include: {
          managers: true,
        },
      },
      responses: {
        where: { status: ResponseStatus.PENDING },
      },
    },
  });

  if (expiredScrims.length === 0) {
    return { expiredCount: 0 };
  }

  let count = 0;

  for (const scrim of expiredScrims) {
    await prisma.$transaction(async (tx) => {
      // 1. Mark scrim as EXPIRED
      await tx.scrimRequest.update({
        where: { id: scrim.id },
        data: { status: ScrimStatus.EXPIRED },
      });

      // 2. Decline any lingering pending responses
      await tx.scrimResponse.updateMany({
        where: {
          requestId: scrim.id,
          status: ResponseStatus.PENDING,
        },
        data: {
          status: ResponseStatus.DECLINED,
        },
      });

      // 3. Notify team managers
      for (const m of scrim.team.managers) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            title: 'Срок действия заявки на прак истек',
            message: `Заявка [${scrim.team.tag}] (${scrim.format}) была автоматически закрыта из-за истечения срока.`,
            type: 'SCRIM_EXPIRED',
            link: `/teams/${scrim.teamId}`,
          },
        });
      }
    });

    count++;
  }

  console.log(`[Worker] Expired ${count} scrim requests.`);
  return { expiredCount: count };
}

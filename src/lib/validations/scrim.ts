import { z } from 'zod';
import { ScrimFormat, ServerBy } from '@prisma/client';

export const slotInputSchema = z.object({
  startsAt: z
    .string()
    .datetime({ message: 'Некорректный формат даты и времени слота (ISO 8601)' })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: 'Время слота должно быть в будущем',
    }),
  durationMin: z.number().int().min(30).max(360).default(120),
});

export const scrimCreateSchema = z.object({
  teamId: z.string().min(1, 'Выберите команду'),
  format: z.nativeEnum(ScrimFormat, { errorMap: () => ({ message: 'Выберите формат (BO1, BO2 или BO3)' }) }),
  level: z.string().trim().max(50, 'Уровень не может превышать 50 символов').optional().nullable(),
  serverBy: z.nativeEnum(ServerBy).default(ServerBy.NEGOTIABLE),
  serverLocations: z.array(z.string()).default([]),
  platform: z
    .enum(['CYBERSHOCK', 'XPLAY', 'FASTCUP', 'OTHER'], {
      errorMap: () => ({ message: 'Выберите платформу (Cybershock, Xplay, Fastcup или Другой)' }),
    })
    .default('CYBERSHOCK'),
  excludedMaps: z
    .array(z.string())
    .max(4, 'Нельзя исключить более 4 карт (в пуле должно оставаться минимум 3 карты)')
    .default([]),
  comment: z
    .string()
    .trim()
    .max(500, 'Комментарий не должен превышать 500 символов')
    .optional()
    .nullable(),
  slots: z
    .array(slotInputSchema)
    .min(1, 'Укажите хотя бы один временной слот')
    .max(10, 'Максимум 10 слотов на одну заявку'),
  expiresInDays: z.number().int().min(1).max(14).default(7),
});

export const scrimResponseSchema = z
  .object({
    teamId: z.string().min(1, 'Выберите команду от имени которой отправляете отклик'),
    slotId: z.string().optional().nullable(),
    proposedAt: z
      .string()
      .datetime({ message: 'Некорректный формат предложенного времени' })
      .optional()
      .nullable(),
    message: z
      .string()
      .trim()
      .max(500, 'Сообщение не должно превышать 500 символов')
      .optional()
      .nullable(),
  })
  .refine((data) => data.slotId || data.proposedAt, {
    message: 'Необходимо выбрать один из предложенных слотов или указать свое время',
    path: ['slotId'],
  });

export type ScrimCreateInput = z.infer<typeof scrimCreateSchema>;
export type ScrimResponseInput = z.infer<typeof scrimResponseSchema>;
export type SlotInput = z.infer<typeof slotInputSchema>;

import { z } from 'zod';
import { ScrimFormat, ServerBy } from '@prisma/client';

export const slotInputSchema = z.object({
  startsAt: z
    .string()
    .datetime({ message: 'Некорректный формат даты и времени слота (ISO 8601)' })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: 'Время слота должно быть в будущем',
    })
    .refine(
      (val) => {
        // Max 5 days from now + 5 min buffer
        const maxAllowed = Date.now() + 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000;
        return new Date(val).getTime() <= maxAllowed;
      },
      {
        message: 'Время прака не может превышать 5 дней от момента создания заявки',
      }
    ),
  durationMin: z.number().int().min(30).max(360).default(120),
});

export const scrimCreateSchema = z.object({
  teamId: z.string().min(1, 'Выберите команду'),
  format: z.nativeEnum(ScrimFormat, { errorMap: () => ({ message: 'Выберите формат (BO1, BO2 или BO3)' }) }),
  level: z.string().trim().max(50, 'Уровень не может превышать 50 символов').optional().nullable(),
  serverBy: z.nativeEnum(ServerBy).default(ServerBy.NEGOTIABLE),
  serverLocations: z
    .array(z.string())
    .max(4, 'Можно выбрать не более 4 серверов')
    .default([]),
  platform: z
    .enum(['CYBERSHOCK', 'XPLAY', 'FASTCUP', 'OTHER'], {
      errorMap: () => ({ message: 'Выберите платформу (Cybershock, Xplay, Fastcup или Другой)' }),
    })
    .default('CYBERSHOCK'),
  excludedMaps: z
    .array(z.string())
    .max(3, 'Нельзя исключить более 3 карт (в пуле должно оставаться минимум 5 карт)')
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
    .max(3, 'Максимум 3 предложения по времени на одну заявку'),
  expiresInDays: z.number().int().min(1).max(14).optional().default(7),
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
  })
  .refine(
    (data) => {
      if (!data.proposedAt) return true;
      const proposedTime = new Date(data.proposedAt).getTime();
      const maxAllowed = Date.now() + 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000;
      return proposedTime > Date.now() && proposedTime <= maxAllowed;
    },
    {
      message: 'Предложенное время должно быть в будущем и не превышать 5 дней от текущего момента',
      path: ['proposedAt'],
    }
  );

export type ScrimCreateInput = z.infer<typeof scrimCreateSchema>;
export type ScrimResponseInput = z.infer<typeof scrimResponseSchema>;
export type SlotInput = z.infer<typeof slotInputSchema>;

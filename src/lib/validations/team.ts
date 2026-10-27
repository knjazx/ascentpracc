import { z } from 'zod';

export const teamCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Название команды должно содержать минимум 2 символа')
    .max(32, 'Название команды не может быть длиннее 32 символов'),
  tag: z
    .string()
    .trim()
    .min(2, 'Тег команды должен содержать от 2 до 8 символов')
    .max(8, 'Тег команды не может быть длиннее 8 символов')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Тег может содержать только латинские буквы, цифры и дефис')
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(500, 'Описание команды не должно превышать 500 символов')
    .optional()
    .nullable(),
  avgElo: z
    .preprocess(
      (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
      z
        .number({ invalid_type_error: 'AVG ELO должно быть числом' })
        .int('AVG ELO должно быть целым числом')
        .min(100, 'Минимальный ELO: 100')
        .max(5000, 'Максимальный ELO: 5000')
        .nullable()
        .optional()
    ),
  discordInvite: z
    .string()
    .trim()
    .url('Введите корректную ссылку на Discord-инвайт')
    .optional()
    .nullable()
    .or(z.literal('')),
  logoUrl: z.string().optional().nullable(),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export const addManagerSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(2, 'Введите Steam-ник или 17-значный SteamID64'),
});

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;
export type AddManagerInput = z.infer<typeof addManagerSchema>;

import { z } from 'zod';

export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .refine((val) => !val || val === 'SYSTEM' || isValidIanaTimezone(val), {
    message: 'Некорректный IANA часовой пояс',
  })
  .optional();

export const discordTagSchema = z
  .string()
  .trim()
  .max(32, 'Discord тег не может превышать 32 символа')
  .refine(
    (val) => {
      if (!val || val.length === 0) return true;
      // Modern Discord usernames (e.g., "username") or legacy tag (e.g., "username#1234")
      return /^[a-zA-Z0-9_.-]{2,32}(?:#\d{4})?$/.test(val);
    },
    {
      message: 'Неверный формат Discord тега (например: nickname или nickname#1234)',
    }
  )
  .optional()
  .nullable();

export const onboardingSchema = z.object({
  timezone: timezoneSchema,
  discordTag: discordTagSchema,
});

export const updateProfileSchema = z.object({
  timezone: timezoneSchema.optional(),
  discordTag: discordTagSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

import { z } from 'zod';

export function isValidCS2Score(
  scoreA: number,
  scoreB: number
): { valid: boolean; reason?: string } {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { valid: false, reason: 'Счёт должен быть целым числом' };
  }

  if (scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) {
    return { valid: false, reason: 'Счёт раундов должен быть в диапазоне от 0 до 99' };
  }

  if (scoreA === scoreB) {
    return {
      valid: false,
      reason: 'Ничья на отдельной карте в CS2 невозможна (должны быть сыграны овертаймы)',
    };
  }

  const high = Math.max(scoreA, scoreB);
  const low = Math.min(scoreA, scoreB);

  // 1. Regular time win (MR12: 13 wins, low <= 11)
  if (high === 13) {
    if (low <= 11) {
      return { valid: true };
    }
    return { valid: false, reason: 'При счёте 12-12 должны назначаться овертаймы' };
  }

  // If high < 13, the map was not finished
  if (high < 13) {
    return { valid: false, reason: 'Для победы в основное время команда должна набрать минимум 13 раундов' };
  }

  // 2. Overtime rules (MR3: 16, 19, 22, 25... with 2+ difference)
  // For k-th overtime: high = 13 + 3k (16, 19, 22...), low must be between (high - 4) and (high - 2)
  if (high >= 16) {
    const diff = high - low;
    if (diff < 2) {
      return { valid: false, reason: 'В овертаймах разница в счёте должна быть минимум 2 раунда' };
    }

    // High must match 13 + 3k (i.e. (high - 13) % 3 === 0 or (high - 16) % 3 === 0)
    if ((high - 16) % 3 === 0) {
      // Overtime ending score
      if (diff >= 2 && low >= high - 4) {
        return { valid: true };
      }
    }

    return {
      valid: false,
      reason: `Некорректный счёт овертайма (${high}:${low}). По правилам CS2 MR3 победа достигается при счёте 16, 19, 22 и т.д.`,
    };
  }

  return { valid: false, reason: 'Некорректный счёт по правилам CS2 MR12' };
}

export const singleMapScoreSchema = z.object({
  mapId: z.string().min(1, 'Укажите ID карты'),
  scoreA: z.number().int().min(0).max(99),
  scoreB: z.number().int().min(0).max(99),
});

export const matchScoreSubmissionSchema = z.object({
  maps: z
    .array(singleMapScoreSchema)
    .min(1, 'Необходимо указать счёт хотя бы по одной карте'),
  screenshotUrl: z.string().url().optional().nullable().or(z.literal('')),
});

export const postMatchReviewSchema = z.object({
  punctuality: z.number().int().min(1).max(5),
  sportsmanship: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().nullable(),
});

export type MatchScoreSubmissionInput = z.infer<typeof matchScoreSubmissionSchema>;
export type PostMatchReviewInput = z.infer<typeof postMatchReviewSchema>;

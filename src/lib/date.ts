import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

export function formatUtcToLocal(
  utcDate: Date | string,
  timeZone?: string,
  formatStr: string = 'dd.MM.yyyy HH:mm'
): string {
  try {
    const tz = !timeZone || timeZone === 'SYSTEM' ? getSystemTimezone() : timeZone;
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return formatInTimeZone(date, tz, formatStr, { locale: ru });
  } catch {
    return String(utcDate);
  }
}

export function formatSlotDateTime(
  utcDate: Date | string,
  timeZone?: string
): { dateStr: string; timeStr: string; relativeStr: string } {
  try {
    const tz = !timeZone || timeZone === 'SYSTEM' ? getSystemTimezone() : timeZone;
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    const zoned = toZonedTime(date, tz);

    let datePrefix = formatInTimeZone(date, tz, 'd MMMM (EEEE)', { locale: ru });
    if (isToday(zoned)) {
      datePrefix = 'Сегодня';
    } else if (isTomorrow(zoned)) {
      datePrefix = 'Завтра';
    }

    const timeStr = formatInTimeZone(date, tz, 'HH:mm', { locale: ru });
    const relativeStr = formatDistanceToNow(date, { addSuffix: true, locale: ru });

    return {
      dateStr: datePrefix,
      timeStr,
      relativeStr,
    };
  } catch {
    return {
      dateStr: 'Неизвестно',
      timeStr: '--:--',
      relativeStr: '',
    };
  }
}

export const formatUtcToZoned = formatUtcToLocal;

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'SYSTEM', label: '⚡ Автоматически из системы (рекомендуется)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (Москва, UTC+3)' },
  { value: 'Europe/Kyiv', label: 'Europe/Kyiv (Киев, UTC+2 / UTC+3)' },
  { value: 'Europe/Minsk', label: 'Europe/Minsk (Минск, UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Europe/Kaliningrad (Калининград, UTC+2)' },
  { value: 'Europe/Samara', label: 'Europe/Samara (Самара, UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Asia/Yekaterinburg (Екатеринбург, UTC+5)' },
  { value: 'Asia/Omsk', label: 'Asia/Omsk (Омск, UTC+6)' },
  { value: 'Asia/Novosibirsk', label: 'Asia/Novosibirsk (Новосибирск, UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Asia/Krasnoyarsk (Красноярск, UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Asia/Irkutsk (Иркутск, UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Asia/Yakutsk (Якутск, UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Asia/Vladivostok (Владивосток, UTC+10)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (Алматы, UTC+5)' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent (Ташкент, UTC+5)' },
  { value: 'Asia/Tbilisi', label: 'Asia/Tbilisi (Тбилиси, UTC+4)' },
  { value: 'Asia/Yerevan', label: 'Asia/Yerevan (Ереван, UTC+4)' },
  { value: 'Asia/Baku', label: 'Asia/Baku (Баку, UTC+4)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (Варшава, UTC+1 / UTC+2)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (Берлин, UTC+1 / UTC+2)' },
  { value: 'Europe/Prague', label: 'Europe/Prague (Прага, UTC+1 / UTC+2)' },
  { value: 'Europe/London', label: 'Europe/London (Лондон, UTC+0 / UTC+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (Париж, UTC+1 / UTC+2)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (Рим, UTC+1 / UTC+2)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (Мадрид, UTC+1 / UTC+2)' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki (Хельсинки, UTC+2 / UTC+3)' },
  { value: 'Europe/Bucharest', label: 'Europe/Bucharest (Бухарест, UTC+2 / UTC+3)' },
  { value: 'Europe/Athens', label: 'Europe/Athens (Афины, UTC+2 / UTC+3)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (Стамбул, UTC+3)' },
  { value: 'UTC', label: 'UTC (Координированное всемирное время)' },
];

export interface ServerLocationOption {
  id: string;
  city: string;
  country: string;
  flag: string;
  ping: number;
}

export const SERVER_LOCATIONS: ServerLocationOption[] = [
  { id: 'kiev', city: 'Киев', country: 'UA', flag: '🇺🇦', ping: 2 },
  { id: 'warsaw', city: 'Варшава', country: 'PL', flag: '🇵🇱', ping: 14 },
  { id: 'vilnius', city: 'Вильнюс', country: 'LT', flag: '🇱🇹', ping: 22 },
  { id: 'limburg', city: 'Лимбург', country: 'DE', flag: '🇩🇪', ping: 29 },
  { id: 'strasbourg', city: 'Страсбург', country: 'FR', flag: '🇫🇷', ping: 31 },
  { id: 'frankfurt', city: 'Франкфурт', country: 'DE', flag: '🇩🇪', ping: 31 },
  { id: 'moscow', city: 'Москва', country: 'RU', flag: '🇷🇺', ping: 43 },
  { id: 'bucharest', city: 'Бухарест', country: 'RO', flag: '🇷🇴', ping: 44 },
  { id: 'amsterdam', city: 'Амстердам', country: 'NL', flag: '🇳🇱', ping: 47 },
  { id: 'luxembourg', city: 'Люксембург', country: 'LU', flag: '🇱🇺', ping: 47 },
  { id: 'spb', city: 'Санкт-Петербург', country: 'RU', flag: '🇷🇺', ping: 47 },
  { id: 'stockholm', city: 'Стокгольм', country: 'SE', flag: '🇸🇪', ping: 48 },
  { id: 'copenhagen', city: 'Копенгаген', country: 'DK', flag: '🇩🇰', ping: 48 },
  { id: 'helsinki', city: 'Хельсинки', country: 'FI', flag: '🇫🇮', ping: 52 },
];

export const SERVER_LOCATION_MAP: Record<string, ServerLocationOption> =
  SERVER_LOCATIONS.reduce<Record<string, ServerLocationOption>>((acc, loc) => {
    acc[loc.city] = loc;
    acc[loc.id] = loc;
    return acc;
  }, {});

export function formatServerDisplay(locations?: string[] | null, fallbackServerBy?: string): string {
  if (locations && locations.length > 0) {
    return locations.join(', ');
  }
  if (fallbackServerBy === 'HOST') return 'Сервер организатора (HOST)';
  if (fallbackServerBy === 'GUEST') return 'Сервер соперника (GUEST)';
  return 'По договоренности';
}

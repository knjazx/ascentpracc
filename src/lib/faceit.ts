export interface FaceitLevelInfo {
  level: number;
  name: string;
  minElo: number;
  maxElo: number | null;
  rangeText: string;
  icon: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
}

export const FACEIT_LEVELS: FaceitLevelInfo[] = [
  {
    level: 1,
    name: 'LVL 1',
    minElo: 100,
    maxElo: 500,
    rangeText: '100 – 500 ELO',
    icon: '/images/faceit/lvl1.svg',
    badgeBg: 'bg-neutral-500/10',
    badgeBorder: 'border-neutral-500/30',
    textColor: 'text-neutral-300',
  },
  {
    level: 2,
    name: 'LVL 2',
    minElo: 501,
    maxElo: 750,
    rangeText: '501 – 750 ELO',
    icon: '/images/faceit/lvl2.svg',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
  },
  {
    level: 3,
    name: 'LVL 3',
    minElo: 751,
    maxElo: 900,
    rangeText: '751 – 900 ELO',
    icon: '/images/faceit/lvl3.svg',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
  },
  {
    level: 4,
    name: 'LVL 4',
    minElo: 901,
    maxElo: 1050,
    rangeText: '901 – 1050 ELO',
    icon: '/images/faceit/lvl4.svg',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  {
    level: 5,
    name: 'LVL 5',
    minElo: 1051,
    maxElo: 1200,
    rangeText: '1051 – 1200 ELO',
    icon: '/images/faceit/lvl5.svg',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  {
    level: 6,
    name: 'LVL 6',
    minElo: 1201,
    maxElo: 1350,
    rangeText: '1201 – 1350 ELO',
    icon: '/images/faceit/lvl6.svg',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  {
    level: 7,
    name: 'LVL 7',
    minElo: 1351,
    maxElo: 1530,
    rangeText: '1351 – 1530 ELO',
    icon: '/images/faceit/lvl7.svg',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  {
    level: 8,
    name: 'LVL 8',
    minElo: 1531,
    maxElo: 1750,
    rangeText: '1531 – 1750 ELO',
    icon: '/images/faceit/lvl8.svg',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
    textColor: 'text-orange-400',
  },
  {
    level: 9,
    name: 'LVL 9',
    minElo: 1751,
    maxElo: 2000,
    rangeText: '1751 – 2000 ELO',
    icon: '/images/faceit/lvl9.svg',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
    textColor: 'text-orange-400',
  },
  {
    level: 10,
    name: 'LVL 10',
    minElo: 2001,
    maxElo: null,
    rangeText: '2001+ ELO',
    icon: '/images/faceit/lvl10.svg',
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/30',
    textColor: 'text-rose-400',
  },
];

/**
 * Returns Faceit level metadata based on numerical ELO.
 */
export function getFaceitLevelByElo(elo?: number | null): FaceitLevelInfo | null {
  if (typeof elo !== 'number' || elo < 100) {
    return null;
  }
  for (const lvl of FACEIT_LEVELS) {
    if (lvl.maxElo === null) {
      if (elo >= lvl.minElo) return lvl;
    } else {
      if (elo >= lvl.minElo && elo <= lvl.maxElo) return lvl;
    }
  }
  return FACEIT_LEVELS[FACEIT_LEVELS.length - 1];
}

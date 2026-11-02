export interface MapDefinition {
  id: string;
  name: string;
  image: string;
  pool: 'ACTIVE_DUTY' | 'EXPANDED';
}

export const ACTIVE_DUTY_MAPS: MapDefinition[] = [
  { id: 'de_dust2', name: 'Dust2', image: '/maps/de_dust2.webp?v=hd1', pool: 'ACTIVE_DUTY' },
  { id: 'de_mirage', name: 'Mirage', image: '/maps/de_mirage.webp?v=hd1', pool: 'ACTIVE_DUTY' },
  { id: 'de_nuke', name: 'Nuke', image: '/maps/de_nuke.webp?v=hd1', pool: 'ACTIVE_DUTY' },
  { id: 'de_ancient', name: 'Ancient', image: '/maps/de_ancient.webp?v=hd1', pool: 'ACTIVE_DUTY' },
  { id: 'de_inferno', name: 'Inferno', image: '/maps/de_inferno.webp?v=hd1', pool: 'ACTIVE_DUTY' },
  { id: 'de_anubis', name: 'Anubis', image: '/maps/de_anubis.webp?v=hd1', pool: 'ACTIVE_DUTY' },
  { id: 'de_cache', name: 'Cache', image: '/maps/de_cache.webp?v=hd1', pool: 'ACTIVE_DUTY' },
];

export const EXPANDED_POOL_MAPS: MapDefinition[] = [
  { id: 'de_vertigo', name: 'Vertigo', image: '/maps/de_vertigo.webp?v=hd1', pool: 'EXPANDED' },
];

export const ALL_MAPS: MapDefinition[] = [...ACTIVE_DUTY_MAPS, ...EXPANDED_POOL_MAPS];

export const MAP_NAMES: Record<string, string> = {
  de_dust2: 'Dust2',
  de_mirage: 'Mirage',
  de_nuke: 'Nuke',
  de_ancient: 'Ancient',
  de_inferno: 'Inferno',
  de_anubis: 'Anubis',
  de_cache: 'Cache',
  de_vertigo: 'Vertigo',
};

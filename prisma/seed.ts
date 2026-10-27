import { PrismaClient, Role } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const DEFAULT_MAPS = [
  { map: 'de_mirage', displayName: 'Mirage', active: true, defaultPool: true, imageUrl: '/maps/de_mirage.webp' },
  { map: 'de_inferno', displayName: 'Inferno', active: true, defaultPool: true, imageUrl: '/maps/de_inferno.webp' },
  { map: 'de_nuke', displayName: 'Nuke', active: true, defaultPool: true, imageUrl: '/maps/de_nuke.webp' },
  { map: 'de_ancient', displayName: 'Ancient', active: true, defaultPool: true, imageUrl: '/maps/de_ancient.webp' },
  { map: 'de_anubis', displayName: 'Anubis', active: true, defaultPool: true, imageUrl: '/maps/de_anubis.webp' },
  { map: 'de_dust2', displayName: 'Dust II', active: true, defaultPool: true, imageUrl: '/maps/de_dust2.webp' },
  { map: 'de_overpass', displayName: 'Overpass', active: true, defaultPool: true, imageUrl: '/maps/de_overpass.webp' },
  { map: 'de_vertigo', displayName: 'Vertigo', active: false, defaultPool: false, imageUrl: '/maps/de_vertigo.webp' },
  { map: 'de_train', displayName: 'Train', active: false, defaultPool: false, imageUrl: '/maps/de_train.webp' },
];

async function main() {
  console.log('--- Starting CS2 Scrim League Database Seeding ---');

  // 1. Seed Map Pool
  console.log('[1/2] Seeding Map Pool...');
  for (const m of DEFAULT_MAPS) {
    await prisma.mapPool.upsert({
      where: { map: m.map },
      update: {
        displayName: m.displayName,
        active: m.active,
        defaultPool: m.defaultPool,
        imageUrl: m.imageUrl,
      },
      create: {
        map: m.map,
        displayName: m.displayName,
        active: m.active,
        defaultPool: m.defaultPool,
        imageUrl: m.imageUrl,
      },
    });
  }
  console.log(`Successfully seeded ${DEFAULT_MAPS.length} maps into MapPool.`);

  // 2. Seed Admin Users from ADMIN_STEAM_IDS
  console.log('[2/2] Checking ADMIN_STEAM_IDS from environment...');
  const adminSteamIdsRaw = process.env.ADMIN_STEAM_IDS || '';
  const adminSteamIds = adminSteamIdsRaw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (adminSteamIds.length === 0) {
    console.log('No ADMIN_STEAM_IDS provided in environment. Skipping admin creation.');
  } else {
    for (const steamId of adminSteamIds) {
      const adminUser = await prisma.user.upsert({
        where: { steamId },
        update: {
          role: Role.ADMIN,
        },
        create: {
          steamId,
          nickname: `Admin (${steamId.slice(-4)})`,
          avatarUrl: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg',
          role: Role.ADMIN,
          onboarded: true,
          timezone: 'Europe/Kyiv',
        },
      });
      console.log(`Configured administrator: ${adminUser.nickname} (Steam ID: ${adminUser.steamId}, Role: ${adminUser.role})`);
    }
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

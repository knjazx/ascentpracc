import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

async function startDatabase() {
  const dataDir = path.resolve(process.cwd(), '.postgres-data');
  console.log('[Embedded Postgres] Initializing at', dataDir);

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgrespassword',
    port: 5432,
    persistent: true,
  });

  try {
    await pg.initialise();
    console.log('[Embedded Postgres] Cluster initialized.');
  } catch (err: unknown) {
    console.log('[Embedded Postgres] Cluster already exists or initialization skipped.');
  }

  await pg.start();
  console.log('[Embedded Postgres] Server running on port 5432.');

  try {
    await pg.createDatabase('cs2_scrims');
    console.log('[Embedded Postgres] Database "cs2_scrims" created.');
  } catch (err) {
    console.log('[Embedded Postgres] Database "cs2_scrims" already exists.');
  }

  console.log('[Embedded Postgres] Ready for connections!');
}

startDatabase().catch(console.error);

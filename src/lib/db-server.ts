import net from 'net';
import path from 'path';

function isPortOpen(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function ensureDatabaseRunning(): Promise<void> {
  // Production / Render / Cloud environments always use remote database (Neon PostgreSQL), never local embedded postgres
  if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL) {
    return;
  }

  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    // Production/remote database (Neon, Supabase, Render), skip local embedded postgres
    return;
  }

  const isOpen = await isPortOpen(5432);
  if (isOpen) {
    console.log('[Database] PostgreSQL is already running on port 5432.');
    return;
  }

  console.log('[Database] Starting local embedded PostgreSQL on port 5432...');

  try {
    const EmbeddedPostgres = (await import('embedded-postgres')).default;
    const dataDir = path.resolve(process.cwd(), '.postgres-data');

    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'postgres',
      password: 'postgrespassword',
      port: 5432,
      persistent: true,
    });

    try {
      await pg.initialise();
    } catch {
      // Already initialized
    }

    await pg.start();

    try {
      await pg.createDatabase('cs2_scrims');
    } catch {
      // Already exists
    }

    console.log('[Database] Local PostgreSQL started successfully on port 5432.');
  } catch (err: unknown) {
    console.warn('[Database] Could not start embedded PostgreSQL:', err instanceof Error ? err.message : err);
  }
}

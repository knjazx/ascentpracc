import { Worker } from 'bullmq';
import { redisConnection } from './connection';
import {
  SCRIM_QUEUE_NAME,
  MATCH_QUEUE_NAME,
  VETO_QUEUE_NAME,
  scrimQueue,
  matchQueue,
} from './queues';
import { processScrimExpirations } from './processors/scrim-processor';
import { processScoreAutoConfirmations } from './processors/score-processor';
import { processMatchReminder } from './processors/reminder-processor';
import { processVetoTimeout } from './processors/veto-processor';

console.log('--------------------------------------------------');
console.log('   CS2 Scrim Platform - BullMQ Background Worker   ');
console.log('--------------------------------------------------');

// 1. Scrim Worker (Expirations)
const scrimWorker = new Worker(
  SCRIM_QUEUE_NAME,
  async (job) => {
    if (job.name === 'check-expirations') {
      return await processScrimExpirations();
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

// 2. Match Worker (Reminders & 24h score confirmations)
const matchWorker = new Worker(
  MATCH_QUEUE_NAME,
  async (job) => {
    if (job.name === 'check-overdue-scores') {
      return await processScoreAutoConfirmations();
    } else if (job.name === 'send-reminder') {
      return await processMatchReminder(job.data);
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

// 3. Veto Worker (60s timer auto-bans)
const vetoWorker = new Worker(
  VETO_QUEUE_NAME,
  async (job) => {
    if (job.name === 'auto-veto-timeout') {
      return await processVetoTimeout(job.data);
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

async function setupScheduledJobs() {
  try {
    // Check scrim expirations every minute
    await scrimQueue.add(
      'check-expirations',
      {},
      {
        repeat: { pattern: '* * * * *' },
        jobId: 'cron-scrim-expirations',
      }
    );

    // Check overdue scores every 10 minutes
    await matchQueue.add(
      'check-overdue-scores',
      {},
      {
        repeat: { pattern: '*/10 * * * *' },
        jobId: 'cron-match-overdue-scores',
      }
    );

    console.log('[Worker] Recurring cron jobs registered successfully.');
  } catch (err: unknown) {
    console.warn('[Worker] Warning setting up cron jobs:', err instanceof Error ? err.message : err);
  }
}

setupScheduledJobs();

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Worker] Gracefully stopping BullMQ workers...');
  await Promise.all([
    scrimWorker.close(),
    matchWorker.close(),
    vetoWorker.close(),
    redisConnection.quit(),
  ]);
  console.log('[Worker] BullMQ workers exited.');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

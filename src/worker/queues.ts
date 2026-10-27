import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export const SCRIM_QUEUE_NAME = 'scrim-tasks';
export const MATCH_QUEUE_NAME = 'match-tasks';
export const VETO_QUEUE_NAME = 'veto-tasks';

export const scrimQueue = new Queue(SCRIM_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export const matchQueue = new Queue(MATCH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export const vetoQueue = new Queue(VETO_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

/**
 * Schedule match reminders (24h, 1h, 15m)
 */
export async function scheduleMatchReminders(matchId: string, scheduledAt: Date) {
  const targetTime = scheduledAt.getTime();
  const now = Date.now();

  const intervals = [
    { label: '24 часа', msBefore: 24 * 60 * 60 * 1000 },
    { label: '1 час', msBefore: 60 * 60 * 1000 },
    { label: '15 минут', msBefore: 15 * 60 * 1000 },
  ];

  for (const item of intervals) {
    const triggerAt = targetTime - item.msBefore;
    const delay = triggerAt - now;

    if (delay > 0) {
      await matchQueue.add(
        'send-reminder',
        { matchId, timeText: item.label },
        { delay, jobId: `reminder-${matchId}-${item.label}` }
      );
    }
  }
}

/**
 * Schedule veto auto-action timeout after 60 seconds
 */
export async function scheduleVetoTimeout(matchId: string, expectedStepOrder: number) {
  await vetoQueue.add(
    'auto-veto-timeout',
    { matchId, stepOrder: expectedStepOrder },
    { delay: 60 * 1000, jobId: `veto-timeout-${matchId}-${expectedStepOrder}` }
  );
}

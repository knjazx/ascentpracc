import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    // Reconnect with exponential backoff capped at 5 seconds
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

redisConnection.on('error', (err) => {
  // Prevent crash on redis connect error in dev mode
  console.warn('[Redis Connection] Warning:', err.message);
});

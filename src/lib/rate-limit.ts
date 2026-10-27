import Redis from 'ioredis';

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redisClient.on('error', (err) => {
      // Suppress spammy connection errors if redis is temporarily offline
      if (process.env.NODE_ENV === 'development') {
        console.warn('[RateLimit] Redis unavailable, using in-memory store:', err.message);
      }
    });
    return redisClient;
  } catch {
    return null;
  }
}

// In-memory fallback
interface MemoryRecord {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, MemoryRecord>();

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const redis = getRedisClient();

  if (redis && redis.status === 'ready') {
    try {
      const redisKey = `ratelimit:${key}`;
      const multi = redis.multi();
      multi.incr(redisKey);
      multi.ttl(redisKey);
      const results = await multi.exec();

      if (results && results[0] && results[1]) {
        const count = results[0][1] as number;
        let ttl = results[1][1] as number;

        if (ttl === -1) {
          await redis.expire(redisKey, windowSec);
          ttl = windowSec;
        }

        const success = count <= limit;
        const remaining = Math.max(0, limit - count);
        const reset = Math.floor(Date.now() / 1000) + ttl;

        return { success, remaining, reset };
      }
    } catch {
      // Fallback to in-memory on redis command error
    }
  }

  // Memory fallback logic
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowSec * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, reset: Math.floor(resetAt / 1000) };
  }

  record.count += 1;
  const success = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);
  const reset = Math.floor(record.resetAt / 1000);

  return { success, remaining, reset };
}

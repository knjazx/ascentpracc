interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(prefix: string): void {
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global singleton to survive HMR in dev
const globalForCache = globalThis as unknown as {
  serverMemoryCache?: MemoryCache;
};

export const memoryCache = globalForCache.serverMemoryCache ?? new MemoryCache();
globalForCache.serverMemoryCache = memoryCache;

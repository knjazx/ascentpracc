'use client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryMap = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Returns cached data if available and not older than maxAgeMs.
 * 0ms in-memory lookup.
 */
export function getClientCache<T>(key: string, maxAgeMs = 180000): T | null {
  // 1. In-memory Map (0ms)
  const mem = memoryMap.get(key);
  if (mem) {
    if (Date.now() - mem.timestamp < maxAgeMs) {
      return mem.data as T;
    }
    memoryMap.delete(key);
  }

  // 2. SessionStorage fallback (survives accidental page refresh, 0ms)
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`ascent_c_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>;
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          memoryMap.set(key, parsed as CacheEntry<unknown>);
          return parsed.data;
        }
        sessionStorage.removeItem(`ascent_c_${key}`);
      }
    } catch {
      // Ignore quota/incognito storage errors
    }
  }

  return null;
}

/**
 * Stale-While-Revalidate helper: returns data immediately even if stale,
 * allowing UI to render in < 1ms while background refresh happens silently.
 */
export function getClientCacheWithStale<T>(
  key: string,
  freshTtlMs = 60000,
  maxStaleMs = 900000
): { data: T | null; isStale: boolean } {
  const mem = memoryMap.get(key);
  if (mem) {
    const age = Date.now() - mem.timestamp;
    if (age < freshTtlMs) {
      return { data: mem.data as T, isStale: false };
    }
    if (age < maxStaleMs) {
      return { data: mem.data as T, isStale: true };
    }
    memoryMap.delete(key);
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`ascent_c_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>;
        const age = Date.now() - parsed.timestamp;
        if (age < freshTtlMs) {
          memoryMap.set(key, parsed as CacheEntry<unknown>);
          return { data: parsed.data, isStale: false };
        }
        if (age < maxStaleMs) {
          memoryMap.set(key, parsed as CacheEntry<unknown>);
          return { data: parsed.data, isStale: true };
        }
        sessionStorage.removeItem(`ascent_c_${key}`);
      }
    } catch {
      // Ignore storage errors
    }
  }

  return { data: null, isStale: true };
}

/**
 * Saves item to in-memory cache and sessionStorage.
 */
export function setClientCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  memoryMap.set(key, entry as CacheEntry<unknown>);

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`ascent_c_${key}`, JSON.stringify(entry));
    } catch {
      // Storage quota safe ignore
    }
  }
}

/**
 * De-duplicated background fetcher: prevents duplicate identical API calls
 * from firing concurrently.
 */
export async function prefetchApi<T>(
  url: string,
  cacheKey: string,
  transform?: (data: any) => any
): Promise<T | null> {
  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    return existing as Promise<T | null>;
  }

  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.success) {
        const payload = transform ? transform(json.data) : json.data;
        setClientCache(cacheKey, payload);
        return payload as T;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, p);
  return p;
}

/**
 * Clears client cache optionally matching a prefix.
 */
export function clearClientCache(prefix?: string): void {
  if (!prefix) {
    memoryMap.clear();
    inFlightRequests.clear();
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith('ascent_c_')) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => sessionStorage.removeItem(k));
      } catch {}
    }
    return;
  }

  memoryMap.forEach((_, key) => {
    if (key.startsWith(prefix)) {
      memoryMap.delete(key);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(`ascent_c_${key}`);
        } catch {}
      }
    }
  });
}

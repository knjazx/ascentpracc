'use client';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryMap = new Map<string, CacheEntry<unknown>>();

export function getClientCache<T>(key: string, maxAgeMs = 120000): T | null {
  // 1. In-memory check (0ms)
  const mem = memoryMap.get(key);
  if (mem) {
    if (Date.now() - mem.timestamp < maxAgeMs) {
      return mem.data as T;
    }
    memoryMap.delete(key);
  }

  // 2. SessionStorage check (persists across navigation & refresh, 0ms)
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
      // Ignore storage read errors (e.g. incognito quota)
    }
  }

  return null;
}

export function setClientCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  memoryMap.set(key, entry as CacheEntry<unknown>);

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`ascent_c_${key}`, JSON.stringify(entry));
    } catch {
      // Ignore storage write errors (e.g. quota limit)
    }
  }
}

export function clearClientCache(prefix?: string): void {
  if (!prefix) {
    memoryMap.clear();
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

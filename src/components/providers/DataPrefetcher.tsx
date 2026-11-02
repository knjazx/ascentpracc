'use client';

import { useEffect } from 'react';
import { getClientCache, setClientCache } from '@/lib/client-cache';

export function DataPrefetcher() {
  useEffect(() => {
    // Schedule background prefetch during browser idle time (or fallback after 80ms)
    const runPrefetch = () => {
      // 1. Scrims Feed
      const scrimsKey = 'feed:1::all:all:all:all';
      if (!getClientCache(scrimsKey)) {
        fetch('/api/scrims?page=1&limit=12')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              setClientCache(scrimsKey, {
                scrims: d.data.scrims,
                totalPages: d.data.pagination.totalPages || 1,
              });
            }
          })
          .catch(() => {});
      }

      // 2. Teams Catalog (aligned with limit=36)
      const teamsKey = 'teams:';
      if (!getClientCache(teamsKey)) {
        fetch('/api/teams?search=&limit=36')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              const list = Array.isArray(d.data.teams) ? d.data.teams : (Array.isArray(d.data) ? d.data : []);
              setClientCache(teamsKey, list);
            }
          })
          .catch(() => {});
      }

      // 3. Matches (Both MY and FINISHED subtabs pre-warmed)
      const myMatchesKey = 'matches:MY:::1';
      if (!getClientCache(myMatchesKey)) {
        fetch('/api/matches?myOnly=true&page=1&limit=15')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              setClientCache(myMatchesKey, d.data);
            }
          })
          .catch(() => {});
      }

      const finishedMatchesKey = 'matches:FINISHED:::1';
      if (!getClientCache(finishedMatchesKey)) {
        fetch('/api/matches?status=CONFIRMED,DISPUTED,CANCELLED&page=1&limit=15')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              setClientCache(finishedMatchesKey, d.data);
            }
          })
          .catch(() => {});
      }

      // 4. Leaderboard
      const leaderboardKey = 'leaderboard:0:winRate:1';
      if (!getClientCache(leaderboardKey)) {
        fetch('/api/leaderboard?minMatches=0&sortBy=winRate&page=1&limit=25')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              setClientCache(leaderboardKey, {
                teams: d.data.teams,
                totalPages: d.data.pagination.totalPages,
              });
            }
          })
          .catch(() => {});
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
        runPrefetch,
        { timeout: 1500 }
      );
      return () => {
        if ('cancelIdleCallback' in window) {
          (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
        }
      };
    } else {
      const timer = setTimeout(runPrefetch, 80);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}

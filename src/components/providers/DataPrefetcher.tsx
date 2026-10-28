'use client';

import { useEffect } from 'react';
import { getClientCache, setClientCache } from '@/lib/client-cache';

export function DataPrefetcher() {
  useEffect(() => {
    // Run background prefetch 150ms after initial page load when browser is idle
    const timer = setTimeout(() => {
      // 1. Scrims
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

      // 2. Teams
      const teamsKey = 'teams:';
      if (!getClientCache(teamsKey)) {
        fetch('/api/teams?search=&limit=24')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              setClientCache(teamsKey, d.data.teams);
            }
          })
          .catch(() => {});
      }

      // 3. Matches
      const matchesKey = 'matches:ALL:::1';
      if (!getClientCache(matchesKey)) {
        fetch('/api/matches?page=1&limit=15')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.data) {
              setClientCache(matchesKey, {
                matches: d.data.matches,
                totalPages: d.data.pagination.totalPages,
              });
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
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return null;
}

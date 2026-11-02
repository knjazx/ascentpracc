'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { prefetchApi, getClientCache } from '@/lib/client-cache';

export const MAIN_TAB_PATHS = ['/', '/teams', '/matches', '/leaderboard'] as const;
export type MainTabPath = (typeof MAIN_TAB_PATHS)[number];

interface MainTabsContextType {
  activeTab: MainTabPath;
  isMainTab: boolean;
  switchTab: (path: string) => void;
  prefetchTab: (path: string) => void;
}

const MainTabsContext = createContext<MainTabsContextType>({
  activeTab: '/',
  isMainTab: true,
  switchTab: () => {},
  prefetchTab: () => {},
});

export function useMainTabs() {
  return useContext(MainTabsContext);
}

// Per-tab scroll position memory so switching back returns user to exact scroll point
const tabScrollPositions: Record<string, number> = {
  '/': 0,
  '/teams': 0,
  '/matches': 0,
  '/leaderboard': 0,
};

export function MainTabsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isCurrentMainTab = (path: string): path is MainTabPath =>
    MAIN_TAB_PATHS.includes(path as MainTabPath);

  const initialTab: MainTabPath = isCurrentMainTab(pathname) ? pathname : '/';
  const [activeTab, setActiveTab] = useState<MainTabPath>(initialTab);

  // Sync state if pathname changes externally (e.g. from /settings or /lobby to /teams)
  useEffect(() => {
    if (isCurrentMainTab(pathname) && pathname !== activeTab) {
      setActiveTab(pathname);
    }
  }, [pathname]);

  // Handle browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const current = window.location.pathname;
      if (isCurrentMainTab(current)) {
        setActiveTab(current);
        const savedScroll = tabScrollPositions[current] || 0;
        window.scrollTo({ top: savedScroll, behavior: 'instant' as ScrollBehavior });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Prefetch data for a given tab on hover / touchstart
  const prefetchTab = useCallback((path: string) => {
    if (path === '/') {
      const key = 'feed:1::all:all:all:all';
      if (!getClientCache(key)) {
        prefetchApi('/api/scrims?page=1&limit=12', key);
      }
    } else if (path === '/teams') {
      const key = 'teams:';
      if (!getClientCache(key)) {
        prefetchApi('/api/teams?search=&limit=36', key, (d) => (d && d.teams ? d.teams : d));
      }
    } else if (path === '/matches') {
      const keyMy = 'matches:MY:::1';
      if (!getClientCache(keyMy)) {
        prefetchApi('/api/matches?myOnly=true&page=1&limit=15', keyMy);
      }
      const keyFinished = 'matches:FINISHED:::1';
      if (!getClientCache(keyFinished)) {
        prefetchApi('/api/matches?status=CONFIRMED,DISPUTED,CANCELLED&page=1&limit=15', keyFinished);
      }
    } else if (path === '/leaderboard') {
      const key = 'leaderboard:0:winRate:1';
      if (!getClientCache(key)) {
        prefetchApi('/api/leaderboard?minMatches=0&sortBy=winRate&page=1&limit=25', key);
      }
    }
  }, []);

  // Instant client-side tab switch (< 16ms / 1 frame)
  const switchTab = useCallback(
    (targetPath: string) => {
      if (!isCurrentMainTab(targetPath)) {
        // If not a main tab, fall back to standard router
        router.push(targetPath);
        return;
      }

      // 1. Save scroll position of current tab
      if (typeof window !== 'undefined') {
        tabScrollPositions[activeTab] = window.scrollY;
      }

      // 2. Pre-warm data if not already cached
      prefetchTab(targetPath);

      // 3. Switch active tab state immediately (0ms React state update)
      setActiveTab(targetPath);

      // 4. Update browser URL history without unmounting or reloading
      if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }

      // 5. Restore scroll position for target tab
      if (typeof window !== 'undefined') {
        const targetScroll = tabScrollPositions[targetPath] || 0;
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetScroll, behavior: 'instant' as ScrollBehavior });
        });
      }
    },
    [activeTab, prefetchTab, router]
  );

  const isMainTab = isCurrentMainTab(pathname);

  return (
    <MainTabsContext.Provider
      value={{
        activeTab,
        isMainTab,
        switchTab,
        prefetchTab,
      }}
    >
      {children}
    </MainTabsContext.Provider>
  );
}

'use client';

import React from 'react';
import { useMainTabs } from '@/context/MainTabsContext';
import { ScrimsTab } from '@/components/tabs/ScrimsTab';
import { TeamsTab } from '@/components/tabs/TeamsTab';
import { MatchesTab } from '@/components/tabs/MatchesTab';
import { LeaderboardTab } from '@/components/tabs/LeaderboardTab';

export function AppTabsShell({ children }: { children: React.ReactNode }) {
  const { activeTab, isMainTab } = useMainTabs();

  return (
    <>
      {/* Persistent 4 Main Tabs: mounted once, switched in 0ms via CSS */}
      <div className={isMainTab ? 'block' : 'hidden'}>
        <div
          role="tabpanel"
          id="panel-scrims"
          aria-hidden={activeTab !== '/'}
          className={activeTab === '/' ? 'block' : 'hidden'}
          style={{ contentVisibility: activeTab === '/' ? 'visible' : 'hidden' }}
        >
          <ScrimsTab />
        </div>

        <div
          role="tabpanel"
          id="panel-teams"
          aria-hidden={activeTab !== '/teams'}
          className={activeTab === '/teams' ? 'block' : 'hidden'}
          style={{ contentVisibility: activeTab === '/teams' ? 'visible' : 'hidden' }}
        >
          <TeamsTab />
        </div>

        <div
          role="tabpanel"
          id="panel-matches"
          aria-hidden={activeTab !== '/matches'}
          className={activeTab === '/matches' ? 'block' : 'hidden'}
          style={{ contentVisibility: activeTab === '/matches' ? 'visible' : 'hidden' }}
        >
          <MatchesTab />
        </div>

        <div
          role="tabpanel"
          id="panel-leaderboard"
          aria-hidden={activeTab !== '/leaderboard'}
          className={activeTab === '/leaderboard' ? 'block' : 'hidden'}
          style={{ contentVisibility: activeTab === '/leaderboard' ? 'visible' : 'hidden' }}
        >
          <LeaderboardTab />
        </div>
      </div>

      {/* Subpages / Detail views (e.g. /scrims/new, /scrims/[id], /lobby/[id], /settings, /admin) */}
      {!isMainTab && children}
    </>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Swords, Search, Calendar, ChevronRight, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatUtcToZoned } from '@/lib/date';
import { useUser } from '@/hooks/useUser';
import { getClientCacheWithStale, setClientCache, prefetchApi } from '@/lib/client-cache';
import { TeamLogo } from '@/components/ui/TeamLogo';

function getWinRateColor(rate: number) {
  if (rate > 50) return 'text-emerald-400';
  if (rate === 50) return 'text-neutral-300';
  return 'text-rose-400';
}

interface MatchItem {
  id: string;
  format: 'BO1' | 'BO2' | 'BO3' | 'BO5';
  status: 'SCHEDULED' | 'VETO' | 'LIVE' | 'AWAITING_RESULT' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  scheduledAt: string;
  winnerId: string | null;
  teamA: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    avgElo?: number | null;
    stats?: { winRate: number; matchesPlayed: number; wins: number; losses: number } | null;
  };
  teamB: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    avgElo?: number | null;
    stats?: { winRate: number; matchesPlayed: number; wins: number; losses: number } | null;
  };
  maps: Array<{
    id: string;
    order: number;
    map: string;
    finalScoreA: number | null;
    finalScoreB: number | null;
  }>;
}

const MatchCard = React.memo(function MatchCard({
  m,
  userTimezone,
}: {
  m: MatchItem;
  userTimezone: string;
}) {
  const scheduledFormatted = formatUtcToZoned(m.scheduledAt, userTimezone, 'dd.MM.yyyy HH:mm');
  const isActive = ['SCHEDULED', 'VETO', 'LIVE', 'AWAITING_RESULT'].includes(m.status);

  // Calculate series score for finished matches
  let seriesWinsA = 0;
  let seriesWinsB = 0;
  m.maps.forEach((map) => {
    if (map.finalScoreA !== null && map.finalScoreB !== null) {
      if (map.finalScoreA > map.finalScoreB) seriesWinsA++;
      else if (map.finalScoreB > map.finalScoreA) seriesWinsB++;
    }
  });

  return (
    <Card className="border border-[#222226] bg-[#111114] hover:border-neutral-600 transition-all duration-200 shadow-xl rounded-xl group">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Format & Status */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isActive && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-[#1c1c22] border border-white/10 text-white font-mono text-xs font-bold">
              {m.format}
            </span>
            {m.status === 'DISPUTED' && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-mono">
                Диспут
              </Badge>
            )}
            {m.status === 'CANCELLED' && (
              <Badge variant="outline" className="text-muted-foreground text-[10px] py-0 px-1.5 font-mono">
                Отменен
              </Badge>
            )}
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              <span>{scheduledFormatted}</span>
            </div>
          </div>

          {/* Center: Teams duel */}
          <div className="flex-1 flex items-center justify-center gap-3 sm:gap-5 min-w-0">
            {/* Team A */}
            <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
              <div className="text-right min-w-0">
                <p className="text-sm sm:text-base font-bold text-white truncate group-hover:text-neutral-100 transition-colors">
                  {m.teamA.name}
                </p>
                <div className="flex items-center justify-end gap-1.5 text-[11px] font-mono text-neutral-400">
                  <span className="text-neutral-300 font-semibold">[{m.teamA.tag}]</span>
                  {typeof m.teamA.stats?.winRate === 'number' && (
                    <span className={`font-bold ${getWinRateColor(Math.round(m.teamA.stats.winRate * 100))}`}>
                      • {Math.round(m.teamA.stats.winRate * 100)}% WR
                    </span>
                  )}
                  {m.teamA.avgElo && (
                    <span className="text-amber-400 font-semibold hidden sm:inline">
                      • {m.teamA.avgElo} ELO
                    </span>
                  )}
                </div>
              </div>

              {/* Logo A */}
              <div className="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-neutral-700/60 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <TeamLogo
                  logoUrl={m.teamA.logoUrl}
                  name={m.teamA.name}
                  tag={m.teamA.tag}
                  size={40}
                />
              </div>
            </div>

            {/* VS or Score */}
            <div className="shrink-0 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-700/60 text-center min-w-[60px] shadow-inner">
              {m.status === 'CONFIRMED' ? (
                <div className="text-sm sm:text-base font-black font-mono tracking-wider text-white">
                  <span className={seriesWinsA > seriesWinsB ? 'text-emerald-400 font-black' : 'text-neutral-400'}>
                    {seriesWinsA}
                  </span>
                  <span className="text-neutral-600 mx-1">:</span>
                  <span className={seriesWinsB > seriesWinsA ? 'text-emerald-400 font-black' : 'text-neutral-400'}>
                    {seriesWinsB}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-black font-mono tracking-widest text-neutral-400">
                  VS
                </span>
              )}
            </div>

            {/* Team B */}
            <div className="flex-1 flex items-center justify-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-neutral-700/60 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                <TeamLogo
                  logoUrl={m.teamB.logoUrl}
                  name={m.teamB.name}
                  tag={m.teamB.tag}
                  size={40}
                />
              </div>

              <div className="text-left min-w-0">
                <p className="text-sm sm:text-base font-bold text-white truncate group-hover:text-neutral-100 transition-colors">
                  {m.teamB.name}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                  <span className="text-neutral-300 font-semibold">[{m.teamB.tag}]</span>
                  {typeof m.teamB.stats?.winRate === 'number' && (
                    <span className={`font-bold ${getWinRateColor(Math.round(m.teamB.stats.winRate * 100))}`}>
                      • {Math.round(m.teamB.stats.winRate * 100)}% WR
                    </span>
                  )}
                  {m.teamB.avgElo && (
                    <span className="text-amber-400 font-semibold hidden sm:inline">
                      • {m.teamB.avgElo} ELO
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="shrink-0 flex items-center justify-end gap-2">
            {isActive && (
              <Link href={`/lobby/${m.id}`}>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 font-mono text-xs font-black uppercase tracking-wider bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-950/30 transition-all group/btn"
                >
                  <span>В лобби</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                </Button>
              </Link>
            )}
            <Link href={`/matches/${m.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 hover:bg-neutral-800/60 transition-all gap-1"
              >
                <span>Детали</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function extractMatchesArray(data: unknown): MatchItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    if ('matches' in data && Array.isArray((data as { matches: unknown }).matches)) {
      return (data as { matches: MatchItem[] }).matches;
    }
  }
  return [];
}

export function MatchesTab() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'MY' | 'FINISHED'>('MY');
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<string>('');
  const [page, setPage] = useState(1);

  const cacheKey = `matches:${activeTab}:${format}:${search.trim()}:${page}`;
  const initialCache = getClientCacheWithStale<{ matches: MatchItem[]; pagination: { totalPages: number } }>(cacheKey);

  const [matches, setMatches] = useState<MatchItem[]>(() =>
    extractMatchesArray(initialCache.data?.matches || initialCache.data)
  );
  const [loading, setLoading] = useState(!initialCache.data);
  const [totalPages, setTotalPages] = useState(initialCache.data?.pagination?.totalPages || 1);

  const fetchMatches = useCallback(
    async (showLoading = false) => {
      try {
        const cached = getClientCacheWithStale<{ matches: MatchItem[]; pagination: { totalPages: number } }>(cacheKey);
        if (cached.data) {
          const list = extractMatchesArray(cached.data.matches || cached.data);
          setMatches(list);
          setTotalPages(cached.data.pagination?.totalPages || 1);
          setLoading(false);
          if (!cached.isStale) return;
        } else if (showLoading) {
          setLoading(true);
        }

        const params = new URLSearchParams();
        if (activeTab === 'MY') {
          params.set('myOnly', 'true');
        } else if (activeTab === 'FINISHED') {
          params.set('status', 'CONFIRMED,DISPUTED,CANCELLED');
        }

        if (format) params.set('format', format);
        if (search.trim()) params.set('search', search.trim());
        params.set('page', String(page));
        params.set('limit', '15');

        const res = await fetch(`/api/matches?${params.toString()}`);
        const data = await res.json();

        if (data.success && data.data) {
          const list = extractMatchesArray(data.data.matches || data.data);
          setMatches(list);
          setTotalPages(data.data.pagination?.totalPages || 1);
          setClientCache(cacheKey, data.data);
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, format, search, page, cacheKey]
  );

  useEffect(() => {
    fetchMatches(!initialCache.data);
  }, [fetchMatches, initialCache.data]);

  // Pre-fetch the alternate tab in the background for instant 0ms switching
  useEffect(() => {
    const alternateTab = activeTab === 'MY' ? 'FINISHED' : 'MY';
    const altKey = `matches:${alternateTab}:${format}::1`;
    if (!getClientCacheWithStale(altKey).data) {
      const url =
        alternateTab === 'MY'
          ? '/api/matches?myOnly=true&page=1&limit=15'
          : '/api/matches?status=CONFIRMED,DISPUTED,CANCELLED&page=1&limit=15';
      prefetchApi(url, altKey);
    }
  }, [activeTab, format]);

  // Instant sub-tab switch
  const switchSubTab = (tab: 'MY' | 'FINISHED') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);

    // Instant SWR check for the target tab
    const targetKey = `matches:${tab}:${format}:${search.trim()}:1`;
    const targetCached = getClientCacheWithStale<{ matches: MatchItem[]; pagination: { totalPages: number } }>(targetKey);
    if (targetCached.data) {
      const list = extractMatchesArray(targetCached.data.matches || targetCached.data);
      setMatches(list);
      setTotalPages(targetCached.data.pagination?.totalPages || 1);
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMatches(true);
  };

  const userTimezone = user?.timezone || 'Europe/Kyiv';

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* Title & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Swords className="w-7 h-7 text-white" />
            <span>История и матчи</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Все официальные практические матчи, результаты серий и текущие скримы лиги
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск по команде / тегу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs w-56 md:w-64 bg-card border-border"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
            Найти
          </Button>
        </form>
      </div>

      {/* Tabs & Format filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222226] pb-4">
        {/* Segmented Pill Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-[#131316] border border-[#222226] shadow-inner">
          <button
            onClick={() => switchSubTab('MY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'MY'
                ? 'bg-white text-black shadow-md shadow-black/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Мои матчи</span>
          </button>
          <button
            onClick={() => switchSubTab('FINISHED')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'FINISHED'
                ? 'bg-white text-black shadow-md shadow-black/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Завершенные</span>
          </button>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-neutral-400 font-mono mr-1">Формат:</span>
          {['', 'BO1', 'BO3', 'BO5'].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFormat(f);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                format === f
                  ? 'bg-neutral-200 text-black font-black shadow-sm'
                  : 'bg-[#131316] border border-[#222226] text-neutral-400 hover:text-white hover:border-neutral-700'
              }`}
            >
              {f || 'Все'}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-[#222226] bg-[#111114] animate-pulse" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <Card className="border border-[#222226] bg-[#111114] shadow-xl py-16 text-center rounded-xl">
          <p className="text-neutral-400 text-sm">
            {activeTab === 'MY' && !user
              ? 'Войдите через Steam, чтобы видеть матчи своих команд'
              : activeTab === 'MY'
              ? 'У ваших команд пока нет активных или назначенных матчей'
              : 'Завершенные матчи не найдены'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(Array.isArray(matches) ? matches : []).map((m) => (
            <MatchCard key={m.id} m={m} userTimezone={userTimezone} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-xs"
          >
            Назад
          </Button>
          <span className="text-xs text-muted-foreground font-mono">
            Страница {page} из {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="text-xs"
          >
            Вперед
          </Button>
        </div>
      )}
    </div>
  );
}

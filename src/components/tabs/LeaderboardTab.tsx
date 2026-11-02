'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, ShieldAlert, Swords, ChevronRight, Award, Flame } from 'lucide-react';
import Link from 'next/link';
import { getClientCacheWithStale, setClientCache } from '@/lib/client-cache';
import { TeamLogo } from '@/components/ui/TeamLogo';

interface LeaderboardTeam {
  rank: number;
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  discordInvite?: string | null;
  noShowCount: number;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    form: string;
    mapStats: Record<string, { played: number; wins: number; winRate: number }>;
  };
  rating: {
    count: number;
    punctuality: number;
    sportsmanship: number;
    average: number;
  };
}

function getWinRateColor(rate: number) {
  if (rate < 50) return 'text-red-500';
  if (rate === 50) return 'text-[#a1a1aa]';
  return 'text-emerald-400';
}

const LeaderboardRow = React.memo(function LeaderboardRow({
  team,
  getRankBadge,
}: {
  team: LeaderboardTeam;
  getRankBadge: (rank: number) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 gap-4 hover:bg-[#161616] transition-colors border-b border-[#1c1c1c] last:border-b-0">
      {/* Rank & Team identity */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-8 flex items-center justify-center shrink-0">
          {getRankBadge(team.rank)}
        </div>

        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center">
          <TeamLogo
            logoUrl={team.logoUrl}
            name={team.name}
            tag={team.tag}
            size={40}
          />
        </div>

        <div className="min-w-0">
          <Link
            href={`/teams/${team.id}`}
            className="font-bold text-sm text-white hover:text-neutral-300 truncate block font-mono"
          >
            {team.name}
          </Link>
          <span className="text-xs font-mono text-[#71717a]">[{team.tag}]</span>
        </div>
      </div>

      {/* Stats Columns */}
      <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 font-mono text-xs">
        {/* WinRate */}
        <div className="w-20 text-center">
          <span className="text-[10px] text-[#71717a] block uppercase sm:hidden">Винрейт</span>
          <span className={`font-black text-sm block ${getWinRateColor(Math.round(team.stats.winRate * 100))}`}>
            {Math.round(team.stats.winRate * 100)}%
          </span>
        </div>

        {/* Matches (Wins / Losses) */}
        <div className="w-20 text-center">
          <span className="text-[10px] text-[#71717a] block uppercase sm:hidden">В / Л</span>
          <span className="text-neutral-200">
            <span className="text-emerald-400 font-bold">{team.stats.wins}</span>
            <span className="text-[#52525b] mx-0.5">/</span>
            <span className="text-rose-400 font-bold">{team.stats.losses}</span>
          </span>
        </div>

        {/* Rating */}
        <div className="w-20 text-center">
          <span className="text-[10px] text-[#71717a] block uppercase sm:hidden">Рейтинг</span>
          <div className="flex items-center justify-center gap-1 text-amber-400">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="font-bold text-white">
              {team.rating.average ? team.rating.average.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="w-24 justify-end hidden sm:flex">
          <Link href={`/teams/${team.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-[#2a2a2a] text-[#a1a1aa] hover:text-white hover:border-neutral-500 hover:bg-white/5 px-2.5"
            >
              <span>Профиль</span>
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
});

function extractLeaderboardArray(data: unknown): LeaderboardTeam[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    if ('teams' in data && Array.isArray((data as { teams: unknown }).teams)) {
      return (data as { teams: LeaderboardTeam[] }).teams;
    }
  }
  return [];
}

export function LeaderboardTab() {
  const [minMatches, setMinMatches] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'winRate' | 'wins' | 'matchesPlayed'>('winRate');
  const [page, setPage] = useState(1);

  const cacheKey = `leaderboard:${minMatches}:${sortBy}:${page}`;
  const initialCache = getClientCacheWithStale<{ teams: LeaderboardTeam[]; totalPages: number }>(cacheKey);

  const [teams, setTeams] = useState<LeaderboardTeam[]>(() =>
    extractLeaderboardArray(initialCache.data?.teams || initialCache.data)
  );
  const [loading, setLoading] = useState(!initialCache.data);
  const [totalPages, setTotalPages] = useState(initialCache.data?.totalPages || 1);

  const fetchLeaderboard = useCallback(async (showLoading = false) => {
    try {
      const key = `leaderboard:${minMatches}:${sortBy}:${page}`;
      const cached = getClientCacheWithStale<{ teams: LeaderboardTeam[]; totalPages: number }>(key);
      if (cached.data) {
        const list = extractLeaderboardArray(cached.data.teams || cached.data);
        setTeams(list);
        setTotalPages(cached.data.totalPages || 1);
        setLoading(false);
        if (!cached.isStale) return;
      } else if (showLoading) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        minMatches: String(minMatches),
        sortBy,
        page: String(page),
        limit: '25',
      });

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        const list = extractLeaderboardArray(data.data.teams || data.data);
        setTeams(list);
        const total = data.data.pagination?.totalPages || 1;
        setTotalPages(total);
        setClientCache(key, { teams: list, totalPages: total });
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [minMatches, sortBy, page]);

  useEffect(() => {
    fetchLeaderboard(!initialCache.data);
  }, [fetchLeaderboard, initialCache.data]);

  const getRankBadge = useCallback((rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-7 h-7 rounded-full bg-[#ffd700] text-black flex items-center justify-center font-black text-xs shadow-sm">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-[#e2e8f0] text-black flex items-center justify-center font-bold text-xs shadow-sm">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-7 h-7 rounded-full bg-[#cd7f32] text-white flex items-center justify-center font-bold text-xs shadow-sm">
          3
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-full bg-[#1c1c1c] text-[#71717a] flex items-center justify-center font-mono text-xs">
        {rank}
      </span>
    );
  }, []);

  return (
    <div className="container py-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl border border-[#222222] bg-[#111111] shadow-2xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-semibold text-neutral-300">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Рейтинговая таблица</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider text-white font-mono">
            Лидерборд команд
          </h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
            Рейтинг сильнейших команд по проценту побед, сыгранным сериям и спортивной дисциплине.
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSortBy('winRate'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              sortBy === 'winRate'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#181818] border border-[#2a2a2a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            По винрейту
          </button>
          <button
            onClick={() => { setSortBy('wins'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              sortBy === 'wins'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#181818] border border-[#2a2a2a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            По победам
          </button>
          <button
            onClick={() => { setSortBy('matchesPlayed'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              sortBy === 'matchesPlayed'
                ? 'bg-white text-black shadow-md'
                : 'bg-[#181818] border border-[#2a2a2a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            По активности
          </button>
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <Card className="border border-[#222222] bg-[#111111] shadow-2xl overflow-hidden rounded-2xl">
        <div className="hidden sm:flex items-center justify-between p-4 px-6 border-b border-[#1c1c1c] text-[11px] font-mono uppercase font-bold text-[#71717a]">
          <div className="flex items-center gap-12">
            <span className="w-8 text-center">Ранг</span>
            <span>Команда</span>
          </div>
          <div className="flex items-center gap-6 sm:gap-8">
            <span className="w-20 text-center">Винрейт</span>
            <span className="w-20 text-center">В / Л</span>
            <span className="w-20 text-center">Рейтинг</span>
            <span className="w-24"></span>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-[#161616] animate-pulse" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center space-y-2 text-[#71717a]">
              <Trophy className="w-10 h-10 mx-auto stroke-1" />
              <p className="text-sm">В рейтинге пока нет команд</p>
            </div>
          ) : (
            <div>
              {(Array.isArray(teams) ? teams : []).map((t) => (
                <LeaderboardRow key={t.id} team={t} getRankBadge={getRankBadge} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
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

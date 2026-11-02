'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/useUser';
import {
  Search,
  Plus,
  Trophy,
  Users,
  Shield,
  ArrowRight,
  Swords,
  X,
  Star,
  Flame,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { getClientCacheWithStale, setClientCache } from '@/lib/client-cache';
import { ChallengeModal } from '@/components/teams/ChallengeModal';
import { FaceitBadge } from '@/components/ui/FaceitBadge';
import { TeamLogo } from '@/components/ui/TeamLogo';

function getWinRateDisplay(winRate: number, matchesCount: number) {
  if (matchesCount === 0) {
    return { text: '0%', color: 'text-[#71717a]' };
  }
  if (winRate > 50) {
    return { text: `${winRate}%`, color: 'text-emerald-400' };
  }
  if (winRate === 50) {
    return { text: `${winRate}%`, color: 'text-neutral-300' };
  }
  return { text: `${winRate}%`, color: 'text-red-400' };
}

function renderFormPills(formStr?: string | null) {
  if (!formStr || formStr.trim() === '') {
    return <span className="text-xs font-mono font-bold text-[#71717a]">—</span>;
  }
  const clean = formStr.replace(/[^WLDwld]/g, '').toUpperCase();
  if (!clean) {
    return <span className="text-xs font-mono font-bold text-[#71717a]">—</span>;
  }
  const chars = clean.slice(-4).split('');

  return (
    <div className="flex items-center justify-center gap-1">
      {chars.map((c, i) => {
        let style = 'bg-[#181818] text-[#71717a] border border-[#2a2a2a]';
        if (c === 'W') {
          style = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
        } else if (c === 'L') {
          style = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
        } else if (c === 'D') {
          style = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
        }
        return (
          <span
            key={i}
            className={`w-4 h-4 rounded text-[9px] font-mono font-black flex items-center justify-center shrink-0 ${style}`}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}

function formatRatingCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${count} оценок`;
  if (mod10 === 1) return `${count} оценка`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} оценки`;
  return `${count} оценок`;
}

interface TeamItem {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  description: string | null;
  avgElo: number | null;
  noShowCount: number;
  totalMatches: number;
  ratingCount?: number;
  avgPunctuality?: number;
  avgSportsmanship?: number;
  overallRating?: number;
  trustFactor?: number;
  stats: {
    winRate: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    form?: string;
  } | null;
  managers: Array<{
    user: {
      id: string;
      nickname: string;
      avatarUrl: string;
    };
  }>;
}

function extractTeamsArray(data: unknown): TeamItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    if ('teams' in data && Array.isArray((data as { teams: unknown }).teams)) {
      return (data as { teams: TeamItem[] }).teams;
    }
  }
  return [];
}

export function TeamsTab() {
  const router = useRouter();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ELO' | 'ACTIVE' | 'MINE'>('ALL');

  const cacheKey = `teams:${search.trim()}`;
  const initialCache = getClientCacheWithStale<unknown>(cacheKey);

  const [teams, setTeams] = useState<TeamItem[]>(() => extractTeamsArray(initialCache.data));
  const [loading, setLoading] = useState(() => !initialCache.data);
  const [challengeTargetTeam, setChallengeTargetTeam] = useState<TeamItem | null>(null);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  const handleChallenge = useCallback(
    (team: TeamItem) => {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!user.teams || user.teams.length === 0) {
        router.push('/teams/new');
        return;
      }
      setChallengeTargetTeam(team);
      setIsChallengeModalOpen(true);
    },
    [user, router]
  );

  const fetchTeams = useCallback(async (query: string) => {
    try {
      const key = `teams:${query.trim()}`;
      const cached = getClientCacheWithStale<unknown>(key);
      const safeCached = extractTeamsArray(cached.data);
      if (safeCached.length > 0 || (cached.data && Array.isArray(cached.data))) {
        setTeams(safeCached);
        setLoading(false);
        if (!cached.isStale) return;
      } else {
        setLoading(true);
      }

      const res = await fetch(`/api/teams?search=${encodeURIComponent(query)}&limit=36`);
      const data = await res.json();
      if (data.success && data.data) {
        const list = extractTeamsArray(data.data);
        setTeams(list);
        setClientCache(key, list);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => {
        fetchTeams(search);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      fetchTeams('');
    }
  }, [search, fetchTeams]);

  // Client-side quick filter/sorting
  const filteredTeams = useMemo(() => {
    const list = extractTeamsArray(teams);
    let result = [...list];

    if (activeTab === 'ELO') {
      result.sort((a, b) => (b.avgElo || 0) - (a.avgElo || 0));
    } else if (activeTab === 'ACTIVE') {
      result = result.filter((t) => (t.stats?.matchesPlayed || 0) > 0);
    } else if (activeTab === 'MINE') {
      if (user?.teams) {
        const myTeamIds = new Set(user.teams.map((t) => t.id));
        result = result.filter((t) => myTeamIds.has(t.id));
      } else {
        result = [];
      }
    }

    return result;
  }, [teams, activeTab, user]);

  return (
    <div className="container py-8 max-w-7xl space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl border border-[#222222] bg-[#111111] shadow-2xl">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-semibold text-neutral-300">
            <Shield className="w-3.5 h-3.5 text-white" />
            <span>Каталог команд</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider text-white font-mono">
            Команды лиги
          </h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
            Находите соперников для праков, изучайте винрейт, ELO и бросайте вызовы капитанам в один клик.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/teams/new">
            <Button variant="cs" className="gap-2 font-bold uppercase tracking-wider text-xs h-11 px-5 shadow-lg">
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Создать команду</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Bar: Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2 rounded-xl border border-[#222222] bg-[#111111]">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-white text-black shadow-md'
                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
            }`}
          >
            Все команды
          </button>
          <button
            onClick={() => setActiveTab('ELO')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
              activeTab === 'ELO'
                ? 'bg-white text-black shadow-md'
                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Топ по ELO</span>
          </button>
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-black shadow-md'
                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>С матчами</span>
          </button>
          {user && (
            <button
              onClick={() => setActiveTab('MINE')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
                activeTab === 'MINE'
                  ? 'bg-white text-black shadow-md'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Мои команды</span>
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717a]" />
          <Input
            type="text"
            placeholder="Поиск по названию или тегу..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs bg-[#161616] border-[#2a2a2a] focus:border-white text-white placeholder:text-[#71717a]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-[#71717a] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl border border-[#222222] bg-[#141414] animate-pulse"
            />
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-[#222222] bg-[#111111] space-y-3">
          <Users className="w-12 h-12 text-[#52525b] mx-auto stroke-1" />
          <h3 className="font-bold text-white text-base">Команды не найдены</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
            {search
              ? 'По вашему запросу ничего не нашлось. Попробуйте изменить поисковый запрос.'
              : activeTab === 'MINE'
              ? 'Вы пока не состоите ни в одной команде. Создайте свою команду, чтобы участвовать в праках.'
              : 'В каталоге пока нет команд по заданным критериям.'}
          </p>
          {activeTab === 'MINE' && (
            <div className="pt-2">
              <Link href="/teams/new">
                <Button variant="cs" size="sm">
                  Создать команду
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => {
            const matchesCount = team.stats?.matchesPlayed || 0;
            const winRate = team.stats?.winRate ? Math.round(team.stats.winRate * 100) : 0;
            const winRateDisplay = getWinRateDisplay(winRate, matchesCount);
            const isMyTeam = user?.teams?.some((t) => t.id === team.id);

            return (
              <div
                key={team.id}
                className="group relative flex flex-col justify-between rounded-xl border border-[#222222] bg-[#131316] hover:border-neutral-500 transition-all duration-200 overflow-hidden shadow-lg hover:shadow-black/50"
              >
                {/* Header & Logo */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[#2a2a2a] bg-[#181818] shadow-inner">
                        <TeamLogo logoUrl={team.logoUrl} name={team.name} tag={team.tag} size={56} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/teams/${team.id}`}
                            className="font-black text-sm text-white hover:text-neutral-200 truncate block font-mono"
                          >
                            {team.name}
                          </Link>
                          {isMyTeam && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Ваша
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-[#a1a1aa]">
                          <span className="text-white font-semibold">[{team.tag}]</span>
                          {team.avgElo && (
                            <FaceitBadge elo={team.avgElo} size="sm" showElo />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Table Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#1f1f1f] text-center font-mono">
                    <div className="p-2 rounded-lg bg-[#0e0e10] border border-[#1f1f1f]">
                      <span className="text-[10px] text-[#71717a] block uppercase font-bold">Матчи</span>
                      <span className="text-xs font-bold text-white">{matchesCount}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#0e0e10] border border-[#1f1f1f]">
                      <span className="text-[10px] text-[#71717a] block uppercase font-bold">Винрейт</span>
                      <span className={`text-xs font-bold ${winRateDisplay.color}`}>
                        {winRateDisplay.text}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-[#0e0e10] border border-[#1f1f1f]">
                      <span className="text-[10px] text-[#71717a] block uppercase font-bold">Форма</span>
                      <div className="pt-0.5">{renderFormPills(team.stats?.form)}</div>
                    </div>
                  </div>

                  {/* Rating / Trust */}
                  {typeof team.overallRating === 'number' && (team.ratingCount || 0) > 0 ? (
                    <div className="flex items-center justify-between text-xs font-mono px-2 py-1 rounded bg-[#0e0e10] border border-[#1f1f1f] text-[#a1a1aa]">
                      <div className="flex items-center gap-1 text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="font-bold text-white">{team.overallRating.toFixed(1)}</span>
                        <span className="text-[10px] text-[#71717a]">/ 5.0</span>
                      </div>
                      <span className="text-[10px] text-[#71717a]">
                        {formatRatingCount(team.ratingCount!)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Footer Buttons */}
                <div className="p-3 border-t border-[#1f1f1f] bg-[#0c0c0d] flex items-center gap-2">
                  <Link href={`/teams/${team.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-bold border-[#2a2a2a] text-[#a1a1aa] hover:text-white hover:border-neutral-500 hover:bg-white/5 transition-all"
                    >
                      Профиль
                    </Button>
                  </Link>

                  {!isMyTeam && (
                    <Button
                      size="sm"
                      onClick={() => handleChallenge(team)}
                      className="flex-1 text-xs font-mono font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 shadow transition-all gap-1.5"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Вызов</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Challenge Modal */}
      {isChallengeModalOpen && challengeTargetTeam && (
        <ChallengeModal
          targetTeam={challengeTargetTeam}
          userTeams={user?.teams || []}
          isOpen={isChallengeModalOpen}
          onClose={() => {
            setIsChallengeModalOpen(false);
            setChallengeTargetTeam(null);
          }}
        />
      )}
    </div>
  );
}

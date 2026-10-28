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
import { getClientCache, setClientCache } from '@/lib/client-cache';
import { ChallengeModal } from '@/components/teams/ChallengeModal';
import { FaceitBadge } from '@/components/ui/FaceitBadge';

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

function TeamLogo({
  logoUrl,
  name,
  tag,
  size = 56,
}: {
  logoUrl?: string | null;
  name: string;
  tag: string;
  size?: number;
}) {
  const [hasError, setHasError] = useState(false);

  const isValidUrl =
    Boolean(logoUrl) &&
    !hasError &&
    (logoUrl!.startsWith('http://') ||
      logoUrl!.startsWith('https://') ||
      logoUrl!.startsWith('/') ||
      logoUrl!.startsWith('data:image/'));

  if (!isValidUrl) {
    const initials = (tag || name.slice(0, 3) || 'CS').toUpperCase().slice(0, 4);
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#222222] via-[#161616] to-[#0c0c0c] border border-white/5 select-none text-white relative">
        <span className="font-mono font-black text-sm tracking-wider text-white/90 drop-shadow">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={logoUrl!}
      alt={name}
      width={size}
      height={size}
      className="object-cover w-full h-full"
      unoptimized
      onError={() => setHasError(true)}
    />
  );
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
          style = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
        } else if (c === 'L') {
          style = 'bg-rose-500/20 text-rose-400 border border-rose-500/40';
        }
        return (
          <span
            key={i}
            className={`w-4 h-4 rounded text-[10px] font-mono font-black flex items-center justify-center leading-none ${style}`}
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

export default function TeamsCatalogPage() {
  const router = useRouter();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ELO' | 'ACTIVE' | 'MINE'>('ALL');

  const cacheKey = `teams:${search.trim()}`;
  const initialCache = getClientCache<TeamItem[]>(cacheKey);

  const [teams, setTeams] = useState<TeamItem[]>(initialCache || []);
  const [loading, setLoading] = useState(!initialCache);
  const [challengeTargetTeam, setChallengeTargetTeam] = useState<TeamItem | null>(null);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  const handleChallenge = (team: TeamItem) => {
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
  };

  const fetchTeams = useCallback(async (query: string) => {
    try {
      const key = `teams:${query.trim()}`;
      if (!getClientCache(key)) {
        setLoading(true);
      }
      const res = await fetch(`/api/teams?search=${encodeURIComponent(query)}&limit=36`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeams(data.data.teams);
        setClientCache(key, data.data.teams);
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
      }, 250);
      return () => clearTimeout(timer);
    } else {
      fetchTeams('');
    }
  }, [search, fetchTeams]);

  // Client-side quick filter/sorting
  const filteredTeams = useMemo(() => {
    let result = [...teams];

    if (activeTab === 'ELO') {
      result.sort((a, b) => (b.avgElo || 0) - (a.avgElo || 0));
    } else if (activeTab === 'ACTIVE') {
      result = result.filter(
        (t) => (t.stats?.matchesPlayed || 0) > 0 || t.totalMatches > 0
      );
      result.sort((a, b) => (b.stats?.matchesPlayed || 0) - (a.stats?.matchesPlayed || 0));
    } else if (activeTab === 'MINE' && user?.teams) {
      const myTeamIds = new Set(user.teams.map((t) => t.id));
      result = result.filter((t) => myTeamIds.has(t.id));
    }

    return result;
  }, [teams, activeTab, user]);

  return (
    <div className="container py-8 space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#222222]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white font-mono">
              Команды
            </h1>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              CS2 LEAGUE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#a1a1aa]">
            Каталог зарегистрированных команд для проведения спаррингов и праков
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            {user.teams && user.teams.length >= 1 ? (
              <Link href={`/teams/${user.teams[0].id}`}>
                <Button
                  variant="outline"
                  className="gap-2 font-bold font-mono text-xs tracking-wider border-white/20 text-white hover:bg-white/10 h-10"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Моя команда [{user.teams[0].tag}]</span>
                </Button>
              </Link>
            ) : (
              <Link href="/teams/new">
                <Button variant="cs" className="gap-2 font-bold font-mono text-xs tracking-wider h-10">
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Создать команду</span>
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Control & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-2.5 rounded-xl border border-[#242424] bg-[#0c0c0c] shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
          <Input
            type="text"
            placeholder="Поиск по названию или тегу команды..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 bg-[#141414] border-[#262626] focus-visible:border-white text-white placeholder:text-[#52525b] text-xs h-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-white text-black border-white'
                : 'bg-[#141414] border-[#242424] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
            }`}
          >
            Все команды ({teams.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ELO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border shrink-0 flex items-center gap-1 ${
              activeTab === 'ELO'
                ? 'bg-white text-black border-white'
                : 'bg-[#141414] border-[#242424] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>Топ ELO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border shrink-0 flex items-center gap-1 ${
              activeTab === 'ACTIVE'
                ? 'bg-white text-black border-white'
                : 'bg-[#141414] border-[#242424] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
            }`}
          >
            <Flame className="w-3 h-3 text-orange-400" />
            <span>С матчами</span>
          </button>

          {user?.teams && user.teams.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('MINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border shrink-0 flex items-center gap-1 ${
                activeTab === 'MINE'
                  ? 'bg-white text-black border-white'
                  : 'bg-[#141414] border-[#242424] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Мои команды</span>
            </button>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-2xl border border-[#242424] bg-[#0f0f0f] animate-pulse p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-[#1c1c1c]" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 bg-[#1c1c1c] rounded" />
                  <div className="h-3 w-16 bg-[#1c1c1c] rounded" />
                </div>
              </div>
              <div className="h-12 bg-[#141414] rounded-xl" />
              <div className="h-10 bg-[#141414] rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-16 space-y-3 rounded-2xl border border-[#242424] bg-[#0c0c0c] shadow-xl p-6">
          <Shield className="w-12 h-12 text-[#52525b] mx-auto stroke-[1.5]" />
          <h3 className="text-lg font-bold text-white font-mono uppercase">Команды не найдены</h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
            {search
              ? 'По запросу «' + search + '» ничего не нашлось. Попробуйте изменить поисковый запрос.'
              : 'В данной категории пока нет зарегистрированных команд.'}
          </p>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setActiveTab('ALL');
              }}
              className="text-xs font-mono"
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTeams.map((team) => {
            const winRate = team.stats?.winRate ? Math.round(team.stats.winRate * 100) : 0;
            const matchesCount = team.stats?.matchesPlayed || team.totalMatches || 0;
            const isMyTeam = user?.teams?.some((t) => t.id === team.id);
            const winRateDisplay = getWinRateDisplay(winRate, matchesCount);
            const hasRatings = (team.ratingCount || 0) > 0;
            const overallRating = hasRatings ? (team.overallRating ?? 0) : 0.0;
            const ratingCount = team.ratingCount || 0;

            return (
              <div
                key={team.id}
                className={`group relative rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xl p-5 ${
                  isMyTeam
                    ? 'border-white/30 bg-gradient-to-b from-[#181818] via-[#121212] to-[#0c0c0c] ring-1 ring-white/10'
                    : 'border-[#222222] bg-[#111111] hover:border-neutral-500 hover:bg-[#141414] hover:-translate-y-0.5'
                }`}
              >
                {/* Subtle top accent highlight */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 transition-opacity ${
                    isMyTeam
                      ? 'bg-gradient-to-r from-transparent via-white to-transparent opacity-60'
                      : 'bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100'
                  }`}
                />

                <div className="space-y-4">
                  {/* Top Bar: Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#181818] border border-[#2a2a2a] text-white">
                        [{team.tag}]
                      </span>
                      {/* Faceit Level Icon & ELO Badge */}
                      <FaceitBadge elo={team.avgElo} />

                      {/* Trust / Decency Rating Badge */}
                      <span
                        className={`font-mono font-bold text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                          hasRatings
                            ? overallRating >= 4.5
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : overallRating >= 3.0
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-[#181818] text-[#71717a] border-[#2a2a2a]'
                        }`}
                        title={
                          hasRatings
                            ? `Рейтинг доверия: ${overallRating.toFixed(1)} (${formatRatingCount(ratingCount)})`
                            : 'Рейтинг доверия: 0.0 (Нет оценок)'
                        }
                      >
                        <ShieldCheck
                          className={`w-3.5 h-3.5 shrink-0 ${
                            hasRatings
                              ? overallRating >= 4.5
                                ? 'text-emerald-400'
                                : overallRating >= 3.0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                              : 'text-[#71717a]'
                          }`}
                        />
                        <span>{overallRating.toFixed(1)}</span>
                      </span>
                    </div>

                    {isMyTeam ? (
                      <span className="px-2.5 py-1 rounded-full bg-white text-black font-mono font-black text-[10px] uppercase tracking-wider shrink-0 shadow-sm">
                        Ваша команда
                      </span>
                    ) : team.trustFactor !== undefined && team.trustFactor < 100 ? (
                      <span
                        className={`px-2.5 py-1 rounded-full border font-mono font-bold text-[10px] shrink-0 ${
                          team.trustFactor < 60
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        Trust: {team.trustFactor}%
                      </span>
                    ) : null}
                  </div>

                  {/* Team Identity */}
                  <div className="flex items-center gap-3.5 pt-0.5">
                    <Link
                      href={`/teams/${team.id}`}
                      className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] flex items-center justify-center shrink-0 group-hover:border-white/30 transition-all shadow-md"
                    >
                      <TeamLogo
                        logoUrl={team.logoUrl}
                        name={team.name}
                        tag={team.tag}
                        size={56}
                      />
                    </Link>

                    <div className="overflow-hidden min-w-0 flex-1">
                      <Link
                        href={`/teams/${team.id}`}
                        className="font-black text-xl text-white tracking-tight truncate block group-hover:text-white hover:underline transition-colors leading-snug"
                        title={team.name}
                      >
                        {team.name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono text-[#71717a] flex items-center gap-1">
                          <span>Доверие:</span>
                          <span className={`font-bold ${hasRatings ? 'text-emerald-400' : 'text-[#71717a]'}`}>
                            {overallRating.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-[#52525b]">
                            ({hasRatings ? formatRatingCount(ratingCount) : 'нет оценок'})
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid (3 Tiles) - Elevated Modern Design */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e] text-center">
                    <div className="space-y-0.5">
                      <div className={`text-sm font-mono font-black ${winRateDisplay.color}`}>
                        {winRateDisplay.text}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-[#71717a] uppercase tracking-wider">
                        Винрейт
                      </div>
                    </div>

                    <div className="space-y-0.5 border-x border-[#1e1e1e]">
                      <div className="text-sm font-mono font-black text-white">
                        {matchesCount}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-[#71717a] uppercase tracking-wider">
                        Матчи
                      </div>
                    </div>

                    <div className="space-y-0.5 flex flex-col justify-center">
                      <div className="h-5 flex items-center justify-center">
                        {renderFormPills(team.stats?.form)}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-[#71717a] uppercase tracking-wider">
                        Форма
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-4 border-t border-[#1e1e1e] mt-4">
                  {isMyTeam ? (
                    <Link href={`/teams/${team.id}`} className="block">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-10 font-mono font-bold text-xs uppercase tracking-wider border-[#2e2e2e] bg-[#141414] hover:bg-white hover:text-black hover:border-white text-white gap-2 transition-all shadow-sm"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Управлять командой</span>
                      </Button>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="cs"
                        size="sm"
                        className="flex-1 h-10 font-mono font-black text-xs uppercase tracking-wider gap-2 shadow-sm hover:shadow-white/10"
                        onClick={() => handleChallenge(team)}
                      >
                        <Swords className="w-4 h-4 stroke-[2.2]" />
                        <span>Кинуть вызов</span>
                      </Button>
                      <Link href={`/teams/${team.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 p-0 border-[#282828] bg-[#141414] hover:bg-[#202020] hover:border-white text-[#a1a1aa] hover:text-white transition-colors shrink-0 flex items-center justify-center"
                          title="Профиль команды"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Direct Challenge Modal */}
      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => {
          setIsChallengeModalOpen(false);
          setChallengeTargetTeam(null);
        }}
        targetTeam={challengeTargetTeam}
        userTeams={user?.teams || []}
      />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { getClientCache, setClientCache } from '@/lib/client-cache';
import { ChallengeModal } from '@/components/teams/ChallengeModal';
import { FaceitBadge } from '@/components/ui/FaceitBadge';
import { TrustGauge } from '@/components/ui/TrustGauge';
import {
  Trophy,
  Users,
  Settings,
  MessageSquare,
  Star,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Quote,
  Swords,
  Calendar,
  ExternalLink,
  Flame,
  Check,
  X,
  Minus,
  AlertTriangle,
} from 'lucide-react';

function TeamProfileLogo({
  logoUrl,
  name,
  tag,
}: {
  logoUrl?: string | null;
  name: string;
  tag: string;
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
        <span className="font-mono font-black text-2xl tracking-wider text-white/90 drop-shadow">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={logoUrl!}
      alt={name}
      width={96}
      height={96}
      className="object-cover w-full h-full"
      unoptimized
      onError={() => setHasError(true)}
    />
  );
}

interface TeamDetail {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  description: string | null;
  discordInvite: string | null;
  avgElo: number | null;
  noShowCount: number;
  avgPunctuality: number;
  avgSportsmanship: number;
  ratingCount: number;
  trustFactor?: number;
  activeReportsCount?: number;
  ratingsReceived?: Array<{
    id: string;
    punctuality: number;
    sportsmanship: number;
    comment: string | null;
    createdAt: string;
    byTeam: {
      id: string;
      name: string;
      tag: string;
      logoUrl: string | null;
    };
  }>;
  stats: {
    winRate: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    form: string;
    mapStats: Record<string, { played: number; wins: number; losses: number; winRate: number }>;
  } | null;
  managers: Array<{
    isOwner: boolean;
    user: {
      id: string;
      nickname: string;
      avatarUrl: string;
      steamId: string;
    };
  }>;
  recentMatches: Array<{
    id: string;
    scheduledAt: string;
    format: string;
    status: string;
    winnerId: string | null;
    isTeamA: boolean;
    opponent: {
      id: string;
      name: string;
      tag: string;
      logoUrl: string | null;
    };
    maps: Array<{
      map: string;
      finalScoreA: number | null;
      finalScoreB: number | null;
    }>;
  }>;
}

interface H2HData {
  team: { id: string; name: string; tag: string; logoUrl: string | null };
  opponent: { id: string; name: string; tag: string; logoUrl: string | null };
  totalMatches: number;
  teamWins: number;
  opponentWins: number;
  draws: number;
  mapStats: Record<string, { teamWins: number; opponentWins: number }>;
}

function getWinRateColor(rate: number) {
  if (rate < 50) return 'text-red-500';
  if (rate === 50) return 'text-[#a1a1aa]';
  return 'text-emerald-400';
}

export default function TeamProfilePage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const { user } = useUser();

  const cacheKey = `team:profile:${id}`;
  const initialCache = getClientCache<TeamDetail>(cacheKey);

  const [team, setTeam] = useState<TeamDetail | null>(initialCache);
  const [loading, setLoading] = useState(!initialCache);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'h2h' | 'reputation'>('overview');
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  // H2H state
  const [allTeams, setAllTeams] = useState<Array<{ id: string; name: string; tag: string }>>([]);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>('');
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loadingH2h, setLoadingH2h] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      if (!getClientCache(cacheKey)) {
        setLoading(true);
      }
      const res = await fetch(`/api/teams/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeam(data.data);
        setClientCache(cacheKey, data.data);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  }, [id, cacheKey]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Load candidate teams for H2H comparison
  useEffect(() => {
    async function loadOpponents() {
      try {
        const res = await fetch('/api/teams?limit=50');
        const data = await res.json();
        if (data.success && data.data) {
          const filtered = data.data.teams.filter((t: { id: string }) => t.id !== id);
          setAllTeams(filtered);
          if (filtered.length > 0) {
            setSelectedOpponentId(filtered[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load opponents list:', err);
      }
    }
    loadOpponents();
  }, [id]);

  // Fetch H2H when opponent selected
  useEffect(() => {
    if (!selectedOpponentId) return;
    async function loadH2h() {
      try {
        setLoadingH2h(true);
        const res = await fetch(`/api/teams/${id}/h2h?opponentId=${selectedOpponentId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setH2hData(data.data);
        }
      } catch (err) {
        console.error('Failed to load H2H:', err);
      } finally {
        setLoadingH2h(false);
      }
    }
    loadH2h();
  }, [id, selectedOpponentId]);

  if (loading) {
    return (
      <div className="container py-12 flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Загрузка профиля команды...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container py-16 text-center space-y-4">
        <h2 className="text-xl font-bold">Команда не найдена</h2>
        <Link href="/teams">
          <Button variant="outline">Вернуться в каталог команд</Button>
        </Link>
      </div>
    );
  }

  const isManager =
    user && (team.managers.some((m) => m.user.id === user.id) || user.role === 'ADMIN');

  const winRate = team.stats?.winRate ? Math.round(team.stats.winRate * 100) : 0;
  const hasRatings = (team.ratingCount || 0) > 0;
  const overallRating = hasRatings
    ? Number(((team.avgPunctuality + team.avgSportsmanship) / 2).toFixed(1))
    : 0;
  const punctualityRating = hasRatings ? Number(team.avgPunctuality.toFixed(1)) : 0;
  const sportsmanshipRating = hasRatings ? Number(team.avgSportsmanship.toFixed(1)) : 0;
  const trustFactor = typeof team.trustFactor === 'number' ? team.trustFactor : 100;

  const formatRatingCount = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return `${count} оценка`;
    }
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
      return `${count} оценки`;
    }
    return `${count} оценок`;
  };

  return (
    <div className="container py-8 space-y-8">
      {/* Team Header Banner */}
      <div className="relative rounded-xl border border-[#222222] bg-[#111111] p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Logo */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#0a0a0a] border border-[#222222] flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-black/40">
              <TeamProfileLogo
                logoUrl={team.logoUrl}
                name={team.name}
                tag={team.tag}
              />
            </div>

            {/* Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                  {team.name}
                </h1>
                <Badge variant="cs" className="text-xs px-2 py-0.5">
                  [{team.tag}]
                </Badge>
                {team.avgElo && (
                  <FaceitBadge elo={team.avgElo} size="md" />
                )}
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-mono font-bold flex items-center gap-1.5 ${
                    trustFactor >= 80
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : trustFactor >= 60
                      ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      : 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                  }`}
                  title={`Trust Factor команды: ${trustFactor}%`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Trust: {trustFactor}%</span>
                </Badge>
              </div>

              <p className="text-sm text-[#a1a1aa] max-w-xl">
                {team.description || 'Команда еще не заполнила описание.'}
              </p>

              {/* Opponent Rating Badge */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#0a0a0a] border border-[#222222] text-white font-mono">
                  <ShieldCheck className={`w-3.5 h-3.5 ${hasRatings ? 'text-emerald-400' : 'text-[#71717a]'}`} />
                  <span className="font-bold">{overallRating.toFixed(1)}</span>
                  <span className="text-[11px] text-[#a1a1aa]">общий индекс</span>
                </div>
                <div className="flex items-center gap-1 text-white font-mono">
                  <Clock className={`w-3.5 h-3.5 ${hasRatings ? 'text-amber-400' : 'text-[#71717a]'}`} />
                  <span className="font-bold">{punctualityRating.toFixed(1)}</span>
                  <span className="text-[11px] text-[#a1a1aa]">пунктуальность</span>
                </div>
                <div className="flex items-center gap-1 text-white font-mono">
                  <Star className={`w-3.5 h-3.5 ${hasRatings ? 'text-emerald-400 fill-emerald-400' : 'text-[#71717a]'}`} />
                  <span className="font-bold">{sportsmanshipRating.toFixed(1)}</span>
                  <span className="text-[11px] text-[#a1a1aa]">адекватность</span>
                </div>
                <span className="text-[11px] text-[#52525b] font-mono">
                  ({formatRatingCount(team.ratingCount)})
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {!isManager && (
              <Button
                variant="cs"
                size="sm"
                className="flex-1 sm:flex-initial gap-2 text-xs font-bold tracking-wider"
                onClick={() => {
                  if (!user) {
                    router.push('/login');
                    return;
                  }
                  if (!user.teams || user.teams.length === 0) {
                    router.push('/teams/new');
                    return;
                  }
                  setIsChallengeModalOpen(true);
                }}
              >
                <Swords className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Кинуть вызов</span>
              </Button>
            )}

            {team.discordInvite && (
              <a
                href={team.discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial"
              >
                <Button variant="outline" size="sm" className="w-full gap-2 border-[#222222] text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-white hover:border-white text-xs">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discord</span>
                </Button>
              </a>
            )}

            {isManager && (
              <Link href={`/teams/${team.id}/edit`} className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-[#222222] text-[#a1a1aa] hover:border-white hover:text-white hover:bg-[#1a1a1a]">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Управление</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#222222] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'overview'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          Обзор и состав
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'matches'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          Последние матчи ({team.recentMatches.length})
        </button>
        <button
          onClick={() => setActiveTab('h2h')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'h2h'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          Head-to-Head (H2H)
        </button>
        <button
          onClick={() => setActiveTab('reputation')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'reputation'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Порядочность ({team.ratingCount})</span>
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Key Stats Card */}
          <Card className="md:col-span-2 border border-[#222222] bg-[#111111] shadow-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white">Статистика выступлений</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[#222222] bg-[#0a0a0a] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[#a1a1aa]">Винрейт</span>
                <p className={`text-3xl font-black mt-1 font-mono ${getWinRateColor(winRate)}`}>{winRate}%</p>
              </div>
              <div className="rounded-xl border border-[#222222] bg-[#0a0a0a] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[#a1a1aa]">Матчей</span>
                <p className="text-3xl font-black text-white mt-1 font-mono">
                  {team.stats?.matchesPlayed || 0}
                </p>
              </div>
              <div className="rounded-xl border border-[#222222] bg-[#0a0a0a] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[#a1a1aa]">Побед</span>
                <p className="text-3xl font-black text-white mt-1 font-mono">
                  {team.stats?.wins || 0}
                </p>
              </div>
              <div className="rounded-xl border border-[#222222] bg-[#0a0a0a] p-4 text-center">
                <span className="text-xs uppercase font-mono text-[#a1a1aa]">Поражений</span>
                <p className="text-3xl font-black text-[#ef4444] mt-1 font-mono">
                  {team.stats?.losses || 0}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="border-t border-[#222222] pt-4 flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[#a1a1aa]">Форма команды (последние игры)</span>
              <div className="flex items-center gap-1.5">
                {(team.stats?.form || '-----').split('').map((char, index) => {
                  if (char === 'W') {
                    return (
                      <span key={index} className="w-6 h-6 rounded flex items-center justify-center bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 text-xs font-bold font-mono">
                        W
                      </span>
                    );
                  }
                  if (char === 'L') {
                    return (
                      <span key={index} className="w-6 h-6 rounded flex items-center justify-center bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 text-xs font-bold font-mono">
                        L
                      </span>
                    );
                  }
                  return (
                    <span key={index} className="w-6 h-6 rounded flex items-center justify-center bg-[#0a0a0a] text-[#52525b] border border-[#222222] text-xs font-mono">
                      -
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Managers List */}
          <Card className="border border-[#222222] bg-[#111111] shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <span>Управляющие ({team.managers.length})</span>
            </h2>
            <div className="space-y-3">
              {team.managers.map((m) => (
                <div key={m.user.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[#222222] bg-[#0a0a0a]">
                  <div className="flex items-center gap-3">
                    <Avatar src={m.user.avatarUrl} alt={m.user.nickname} fallback={m.user.nickname} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-white leading-none">{m.user.nickname}</p>
                    </div>
                  </div>
                  {m.isOwner ? (
                    <Badge variant="cs" className="text-[10px] px-1.5 py-0">Владелец</Badge>
                  ) : (
                    <span className="text-[10px] text-[#a1a1aa] font-mono">Со-упр.</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Recent Matches */}
      {activeTab === 'matches' && (
        <div className="space-y-3">
          {team.recentMatches.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-[#222222] bg-[#111111] text-[#a1a1aa] text-sm">
              Нет завершенных матчей.
            </div>
          ) : (
            team.recentMatches.map((m) => {
              const isWinner = m.winnerId === team.id;

              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#222222] bg-[#111111] hover:border-white hover:bg-[#141414] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-center overflow-hidden shrink-0">
                      {m.opponent.logoUrl ? (
                        <Image
                          src={m.opponent.logoUrl}
                          alt={m.opponent.name}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      ) : (
                        <span className="font-mono text-xs font-bold text-white">
                          {m.opponent.tag}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#52525b] uppercase font-mono">vs</span>
                        <Link href={`/teams/${m.opponent.id}`} className="font-bold text-white hover:underline transition-colors">
                          {m.opponent.name}
                        </Link>
                        <span className="text-xs text-[#a1a1aa] font-mono">[{m.opponent.tag}]</span>
                      </div>
                      <span className="text-[11px] text-[#52525b] font-mono">
                        {new Date(m.scheduledAt).toLocaleDateString('ru-RU')} • Формат {m.format}
                      </span>
                    </div>
                  </div>

                  {/* Result & maps */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      {m.maps.map((map, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#222222] text-[#a1a1aa]">
                          {map.map.replace('de_', '')}: {m.isTeamA ? map.finalScoreA : map.finalScoreB}-{m.isTeamA ? map.finalScoreB : map.finalScoreA}
                        </span>
                      ))}
                    </div>

                    <Badge
                      variant={isWinner ? 'default' : 'secondary'}
                      className={`text-xs font-bold font-mono px-3 py-1 ${
                        isWinner
                          ? 'bg-white text-black font-extrabold border-white'
                          : 'bg-[#1a1a1a] text-[#a1a1aa] border-[#222222]'
                      }`}
                    >
                      {isWinner ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Head-to-Head (H2H) */}
      {activeTab === 'h2h' && (
        <Card className="border-[#222222] bg-[#111111] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Сравнение команд (H2H)</h2>
              <p className="text-xs text-[#a1a1aa]">
                Выберите команду соперника для анализа истории очных матчей и побед на картах.
              </p>
            </div>

            <select
              value={selectedOpponentId}
              onChange={(e) => setSelectedOpponentId(e.target.value)}
              className="flex h-10 rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:border-white cursor-pointer max-w-xs"
            >
              {allTeams.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0a0a0a]">
                  {t.name} [{t.tag}]
                </option>
              ))}
            </select>
          </div>

          {loadingH2h ? (
            <div className="py-8 text-center text-[#a1a1aa] text-sm animate-pulse">
              Загрузка личных встреч...
            </div>
          ) : !h2hData || h2hData.totalMatches === 0 ? (
            <div className="py-12 text-center rounded-xl border border-[#222222] bg-[#0a0a0a] text-[#a1a1aa] text-sm">
              Команды еще не встречались между собой в официальных праках лиги.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Duel Banner */}
              <div className="flex items-center justify-between p-6 rounded-xl border border-[#222222] bg-[#0a0a0a]">
                <div className="text-center sm:text-left">
                  <p className="font-black text-xl text-white">{h2hData.team.name}</p>
                  <p className="text-3xl font-black text-white font-mono mt-1">{h2hData.teamWins}</p>
                </div>

                <div className="text-center px-4">
                  <span className="text-xs uppercase font-mono text-[#a1a1aa]">Всего матчей: {h2hData.totalMatches}</span>
                  <p className="text-xs text-[#52525b] font-mono mt-0.5">В - Л: {h2hData.teamWins} - {h2hData.opponentWins}</p>
                </div>

                <div className="text-center sm:text-right">
                  <p className="font-black text-xl text-white">{h2hData.opponent.name}</p>
                  <p className="text-3xl font-black text-[#a1a1aa] font-mono mt-1">{h2hData.opponentWins}</p>
                </div>
              </div>

              {/* H2H Map Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-semibold text-[#a1a1aa] font-mono">Карты в очных встречах</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(h2hData.mapStats).map(([map, s]) => (
                    <div key={map} className="p-3 rounded-lg border border-[#222222] bg-[#0a0a0a] flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">{map.replace('de_', '')}</span>
                      <span>
                        <span className="text-white font-bold">{s.teamWins}W</span> - <span className="text-[#a1a1aa]">{s.opponentWins}W</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Reputation / Decency */}
      {activeTab === 'reputation' && (
        <div className="space-y-6">
          {/* Main Reputation Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Decency Index */}
            <Card className="border-[#222222] bg-[#111111] p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono text-[#a1a1aa] font-semibold">Общий индекс</span>
                <ShieldCheck className={`w-4 h-4 ${hasRatings ? 'text-emerald-400' : 'text-[#71717a]'}`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white">
                  {overallRating.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-[#71717a]">/ 5.0</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                    !hasRatings
                      ? 'bg-[#181818] text-[#71717a] border border-[#2a2a2a]'
                      : overallRating >= 4.5
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : overallRating >= 3.5
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {!hasRatings
                    ? 'Нет оценок'
                    : overallRating >= 4.5
                    ? 'Отличная'
                    : overallRating >= 3.5
                    ? 'Хорошая'
                    : 'Низкая'}
                </span>
                <span className="text-xs text-[#71717a] font-mono">
                  ({formatRatingCount(team.ratingCount)})
                </span>
              </div>
            </Card>

            {/* Punctuality */}
            <Card className="border-[#222222] bg-[#111111] p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono text-[#a1a1aa] font-semibold">Пунктуальность</span>
                <Clock className={`w-4 h-4 ${hasRatings ? 'text-amber-400' : 'text-[#71717a]'}`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white">
                  {punctualityRating.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-[#71717a]">/ 5.0</span>
              </div>
              <div className="w-full bg-[#1c1c1c] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all"
                  style={{ width: `${hasRatings ? Math.min(100, Math.max(0, (punctualityRating / 5) * 100)) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-[#71717a] font-mono leading-tight">
                Своевременный заход на сервер и готовность к праку
              </p>
            </Card>

            {/* Sportsmanship */}
            <Card className="border-[#222222] bg-[#111111] p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono text-[#a1a1aa] font-semibold">Адекватность</span>
                <Star className={`w-4 h-4 ${hasRatings ? 'text-emerald-400 fill-emerald-400' : 'text-[#71717a]'}`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-white">
                  {sportsmanshipRating.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-[#71717a]">/ 5.0</span>
              </div>
              <div className="w-full bg-[#1c1c1c] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${hasRatings ? Math.min(100, Math.max(0, (sportsmanshipRating / 5) * 100)) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-[#71717a] font-mono leading-tight">
                Уважительное общение без токсичности и оскорблений
              </p>
            </Card>

            {/* Trust Factor Card with Circular Gauge from Red to Green */}
            <Card className="border-[#222222] bg-[#111111] p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono text-[#a1a1aa] font-semibold">Рейтинг доверия</span>
                <ShieldCheck
                  className={`w-4 h-4 ${
                    trustFactor >= 80 ? 'text-emerald-400' : trustFactor >= 60 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                />
              </div>

              {/* Circular Gauge and Status Block */}
              <div className="flex items-center gap-4 py-1">
                <TrustGauge value={trustFactor} size={68} strokeWidth={6.5} />

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#71717a]">
                      Trust Factor
                    </span>
                  </div>

                  <div className="pt-0.5">
                    {trustFactor >= 80 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-bold">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{team.activeReportsCount && team.activeReportsCount > 0 ? 'Высокое доверие' : 'Идеальная репутация'}</span>
                      </span>
                    ) : trustFactor >= 60 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-mono font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Есть предупреждения</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-mono font-bold">
                        <X className="w-3.5 h-3.5 shrink-0" />
                        <span>Критический уровень</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#71717a] font-mono leading-tight">
                    {team.activeReportsCount ? `${team.activeReportsCount} активных жалоб` : '0 активных жалоб'}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-[#71717a] font-mono leading-tight pt-1 border-t border-[#1e1e1e]">
                Формируется на основе отсутствия подтвержденных жалоб и соблюдения регламента
              </p>
            </Card>
          </div>

          {/* Opponent Reviews Section */}
          <Card className="border-[#222222] bg-[#111111] p-6 space-y-5 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222222] pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-white" />
                  <span>Отзывы соперников ({team.ratingsReceived?.length || 0})</span>
                </h2>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Оценки, выставленные другими командами после окончания официальных матчей.
                </p>
              </div>
            </div>

            {!team.ratingsReceived || team.ratingsReceived.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-[#222222] bg-[#0a0a0a] space-y-3">
                <Star className="w-10 h-10 text-[#52525b] mx-auto stroke-[1.5]" />
                <p className="text-white font-bold text-sm">Оценок пока нет</p>
                <p className="text-xs text-[#71717a] max-w-md mx-auto font-mono">
                  После завершения официального матча капитаны обеих команд получают возможность оценить соперника по пунктуальности и адекватности.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {team.ratingsReceived.map((rating) => {
                  const ratingDate = new Date(rating.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={rating.id}
                      className="p-4 rounded-xl border border-[#222222] bg-[#0a0a0a] space-y-3 hover:border-[#383838] transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Link href={`/teams/${rating.byTeam.id}`}>
                            <div className="relative w-10 h-10 rounded-lg bg-[#141414] border border-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0 hover:border-white transition-colors">
                              {rating.byTeam.logoUrl ? (
                                <Image
                                  src={rating.byTeam.logoUrl}
                                  alt={rating.byTeam.name}
                                  width={40}
                                  height={40}
                                  className="object-cover w-full h-full"
                                  unoptimized
                                />
                              ) : (
                                <span className="font-mono font-bold text-xs text-white">
                                  {rating.byTeam.tag}
                                </span>
                              )}
                            </div>
                          </Link>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/teams/${rating.byTeam.id}`}
                                className="font-bold text-sm text-white hover:underline transition-colors"
                              >
                                {rating.byTeam.name}
                              </Link>
                              <span className="text-xs font-mono font-bold text-[#a1a1aa] bg-[#161616] px-1.5 py-0.5 rounded border border-[#262626]">
                                [{rating.byTeam.tag}]
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-[#71717a]">
                              {ratingDate}
                            </span>
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161616] border border-[#282828]">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[#a1a1aa]">Пунктуальность:</span>
                            <span className="font-bold text-white">{rating.punctuality}/5</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161616] border border-[#282828]">
                            <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                            <span className="text-[#a1a1aa]">Адекватность:</span>
                            <span className="font-bold text-white">{rating.sportsmanship}/5</span>
                          </div>
                        </div>
                      </div>

                      {/* Comment */}
                      {rating.comment && (
                        <div className="p-3 rounded-lg bg-[#111111] border-l-2 border-white/60 text-xs text-[#d4d4d8] italic font-sans">
                          «{rating.comment}»
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Direct Challenge Modal */}
      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        targetTeam={team}
        userTeams={user?.teams || []}
      />
    </div>
  );
}

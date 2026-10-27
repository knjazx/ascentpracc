'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import {
  Trophy,
  Users,
  Settings,
  MessageSquare,
  Star,
  ShieldAlert,
  Swords,
  Calendar,
  ExternalLink,
  Flame,
  Check,
  X,
  Minus,
} from 'lucide-react';

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

export default function TeamProfilePage() {
  const { id } = useParams() as { id: string };
  const { user } = useUser();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'h2h'>('overview');

  // H2H state
  const [allTeams, setAllTeams] = useState<Array<{ id: string; name: string; tag: string }>>([]);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>('');
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [loadingH2h, setLoadingH2h] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teams/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeam(data.data);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  return (
    <div className="container py-8 space-y-8">
      {/* Team Header Banner */}
      <div className="relative rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-900 via-neutral-950 to-black p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 h-48 w-48 bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Logo */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-neutral-900 border-2 border-neutral-800 flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-black/40">
              {team.logoUrl ? (
                <Image
                  src={team.logoUrl}
                  alt={team.name}
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <span className="font-mono font-black text-white text-2xl">
                  {team.tag}
                </span>
              )}
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
                  <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-white/20 text-white bg-white/10 font-mono font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-white" />
                    <span>{team.avgElo} AVG ELO</span>
                  </Badge>
                )}
                {team.noShowCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    No-Show: {team.noShowCount}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-neutral-400 max-w-xl">
                {team.description || 'Команда еще не заполнила описание.'}
              </p>

              {/* Opponent Rating Badge */}
              <div className="flex items-center gap-4 pt-1 text-xs text-neutral-400">
                <div className="flex items-center gap-1 text-white">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="font-bold font-mono">{team.avgPunctuality}</span>
                  <span className="text-[11px] text-neutral-500">пунктуальность</span>
                </div>
                <div className="flex items-center gap-1 text-neutral-300">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="font-bold font-mono">{team.avgSportsmanship}</span>
                  <span className="text-[11px] text-neutral-500">адекватность</span>
                </div>
                <span className="text-[11px] text-neutral-500">({team.ratingCount} оценок)</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {team.discordInvite && (
              <a
                href={team.discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial"
              >
                <Button variant="outline" size="sm" className="w-full gap-2 border-neutral-700 text-neutral-300 hover:bg-neutral-900 text-xs hover:border-white">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Discord</span>
                </Button>
              </a>
            )}

            {isManager && (
              <Link href={`/teams/${team.id}/edit`} className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs hover:border-white">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Управление</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-white text-black font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          Обзор и состав
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'matches'
              ? 'bg-white text-black font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          Последние матчи ({team.recentMatches.length})
        </button>
        <button
          onClick={() => setActiveTab('h2h')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'h2h'
              ? 'bg-white text-black font-bold'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          Head-to-Head (H2H)
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Key Stats Card */}
          <Card className="md:col-span-2 border border-border bg-card shadow-xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-white">Статистика выступлений</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-cs-panel p-4 text-center">
                <span className="text-xs uppercase font-mono text-neutral-400">Винрейт</span>
                <p className="text-3xl font-black text-white mt-1 font-mono">{winRate}%</p>
              </div>
              <div className="rounded-xl border border-border bg-cs-panel p-4 text-center">
                <span className="text-xs uppercase font-mono text-neutral-400">Матчей</span>
                <p className="text-3xl font-black text-white mt-1 font-mono">
                  {team.stats?.matchesPlayed || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-cs-panel p-4 text-center">
                <span className="text-xs uppercase font-mono text-neutral-400">Побед</span>
                <p className="text-3xl font-black text-white mt-1 font-mono">
                  {team.stats?.wins || 0}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-cs-panel p-4 text-center">
                <span className="text-xs uppercase font-mono text-neutral-400">Поражений</span>
                <p className="text-3xl font-black text-neutral-500 mt-1 font-mono">
                  {team.stats?.losses || 0}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-neutral-400">Форма команды (последние игры)</span>
              <div className="flex items-center gap-1.5">
                {(team.stats?.form || '-----').split('').map((char, index) => {
                  if (char === 'W') {
                    return (
                      <span key={index} className="w-6 h-6 rounded flex items-center justify-center bg-white text-black text-xs font-bold font-mono">
                        W
                      </span>
                    );
                  }
                  if (char === 'L') {
                    return (
                      <span key={index} className="w-6 h-6 rounded flex items-center justify-center bg-cs-panel text-neutral-500 border border-border text-xs font-bold font-mono">
                        L
                      </span>
                    );
                  }
                  return (
                    <span key={index} className="w-6 h-6 rounded flex items-center justify-center bg-cs-panel text-neutral-600 text-xs font-mono">
                      -
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Managers List */}
          <Card className="border border-border bg-card shadow-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <span>Управляющие ({team.managers.length})</span>
            </h2>
            <div className="space-y-3">
              {team.managers.map((m) => (
                <div key={m.user.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-cs-panel">
                  <div className="flex items-center gap-3">
                    <Avatar src={m.user.avatarUrl} alt={m.user.nickname} fallback={m.user.nickname} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-foreground leading-none">{m.user.nickname}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{m.user.steamId}</p>
                    </div>
                  </div>
                  {m.isOwner ? (
                    <Badge variant="cs" className="text-[10px] px-1.5 py-0">Владелец</Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-mono">Со-упр.</span>
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
            <div className="p-8 text-center rounded-xl border border-neutral-800 bg-neutral-900/60 text-muted-foreground text-sm">
              Нет завершенных матчей.
            </div>
          ) : (
            team.recentMatches.map((m) => {
              const isWinner = m.winnerId === team.id;

              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900/90 hover:border-neutral-600 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
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
                        <span className="text-xs text-muted-foreground uppercase font-mono">vs</span>
                        <Link href={`/teams/${m.opponent.id}`} className="font-bold text-foreground hover:text-white transition-colors">
                          {m.opponent.name}
                        </Link>
                        <span className="text-xs text-neutral-400 font-mono">[{m.opponent.tag}]</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(m.scheduledAt).toLocaleDateString('ru-RU')} • Формат {m.format}
                      </span>
                    </div>
                  </div>

                  {/* Result & maps */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      {m.maps.map((map, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-muted-foreground">
                          {map.map.replace('de_', '')}: {m.isTeamA ? map.finalScoreA : map.finalScoreB}-{m.isTeamA ? map.finalScoreB : map.finalScoreA}
                        </span>
                      ))}
                    </div>

                    <Badge
                      variant={isWinner ? 'default' : 'secondary'}
                      className={`text-xs font-bold font-mono px-3 py-1 ${
                        isWinner
                          ? 'bg-white text-black font-extrabold border-white'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
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
        <Card className="border-neutral-800 bg-neutral-950/80 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Сравнение команд (H2H)</h2>
              <p className="text-xs text-neutral-400">
                Выберите команду соперника для анализа истории очных матчей и побед на картах.
              </p>
            </div>

            <select
              value={selectedOpponentId}
              onChange={(e) => setSelectedOpponentId(e.target.value)}
              className="flex h-10 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer max-w-xs"
            >
              {allTeams.map((t) => (
                <option key={t.id} value={t.id} className="bg-neutral-950">
                  {t.name} [{t.tag}]
                </option>
              ))}
            </select>
          </div>

          {loadingH2h ? (
            <div className="py-8 text-center text-neutral-400 text-sm animate-pulse">
              Загрузка личных встреч...
            </div>
          ) : !h2hData || h2hData.totalMatches === 0 ? (
            <div className="py-12 text-center rounded-xl border border-neutral-800 bg-neutral-900/40 text-neutral-400 text-sm">
              Команды еще не встречались между собой в официальных праках лиги.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Duel Banner */}
              <div className="flex items-center justify-between p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
                <div className="text-center sm:text-left">
                  <p className="font-black text-xl text-white">{h2hData.team.name}</p>
                  <p className="text-3xl font-black text-white font-mono mt-1">{h2hData.teamWins}</p>
                </div>

                <div className="text-center px-4">
                  <span className="text-xs uppercase font-mono text-neutral-400">Всего матчей: {h2hData.totalMatches}</span>
                  <p className="text-xs text-neutral-400 font-mono mt-0.5">В - Л: {h2hData.teamWins} - {h2hData.opponentWins}</p>
                </div>

                <div className="text-center sm:text-right">
                  <p className="font-black text-xl text-white">{h2hData.opponent.name}</p>
                  <p className="text-3xl font-black text-neutral-400 font-mono mt-1">{h2hData.opponentWins}</p>
                </div>
              </div>

              {/* H2H Map Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-semibold text-neutral-400 font-mono">Карты в очных встречах</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(h2hData.mapStats).map(([map, s]) => (
                    <div key={map} className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">{map.replace('de_', '')}</span>
                      <span>
                        <span className="text-white font-bold">{s.teamWins}W</span> - <span className="text-neutral-400">{s.opponentWins}W</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

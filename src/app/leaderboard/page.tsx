'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, ShieldAlert, Swords, ChevronRight, Award, Flame } from 'lucide-react';
import Link from 'next/link';
import { getClientCache, setClientCache } from '@/lib/client-cache';

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

export default function LeaderboardPage() {
  const [minMatches, setMinMatches] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'winRate' | 'wins' | 'matchesPlayed'>('winRate');
  const [page, setPage] = useState(1);

  const cacheKey = `leaderboard:${minMatches}:${sortBy}:${page}`;
  const initialCache = getClientCache<{ teams: LeaderboardTeam[]; totalPages: number }>(cacheKey);

  const [teams, setTeams] = useState<LeaderboardTeam[]>(initialCache?.teams || []);
  const [loading, setLoading] = useState(!initialCache);
  const [totalPages, setTotalPages] = useState(initialCache?.totalPages || 1);

  const fetchLeaderboard = async () => {
    try {
      const key = `leaderboard:${minMatches}:${sortBy}:${page}`;
      if (!getClientCache(key)) {
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

      if (data.success) {
        setTeams(data.data.teams);
        const total = data.data.pagination.totalPages;
        setTotalPages(total);
        setClientCache(key, { teams: data.data.teams, totalPages: total });
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [minMatches, sortBy, page]);

  const getRankBadge = (rank: number) => {
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
        <span className="w-7 h-7 rounded-full bg-[#f59e0b] text-black flex items-center justify-center font-bold text-xs shadow-sm">
          3
        </span>
      );
    }
    return (
      <span className="w-7 h-7 flex items-center justify-center font-mono text-xs text-[#a1a1aa]">
        {rank}
      </span>
    );
  };

  const renderFormPills = (formStr: string) => {
    if (!formStr) return <span className="text-xs text-[#52525b]">-</span>;
    const chars = formStr.slice(-5).split('');

    return (
      <div className="flex items-center gap-1">
        {chars.map((c, i) => {
          let color = 'bg-[#0a0a0a] text-[#52525b] border border-[#222222]';
          if (c === 'W') color = 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-bold';
          if (c === 'L') color = 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 font-bold';

          return (
            <span
              key={i}
              className={`w-5 h-5 rounded text-[10px] font-mono flex items-center justify-center ${color}`}
            >
              {c}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container py-8 max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-white" />
            <span>Таблица лидеров Ascent Pracc</span>
          </h1>
          <p className="text-xs md:text-sm text-[#a1a1aa] mt-1">
            Рейтинг команд по результатам сыгранных праков, статистика побед и репутация
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-[#222222] p-1 bg-[#0a0a0a] text-xs">
            <button
              onClick={() => { setMinMatches(0); setPage(1); }}
              className={`px-3 py-1 rounded transition-colors ${
                minMatches === 0 ? 'bg-white text-black font-bold' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Все команды
            </button>
            <button
              onClick={() => { setMinMatches(5); setPage(1); }}
              className={`px-3 py-1 rounded transition-colors ${
                minMatches === 5 ? 'bg-white text-black font-bold' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              От 5 матчей
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
            <span>Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as 'winRate' | 'wins' | 'matchesPlayed');
                setPage(1);
              }}
              className="bg-[#0a0a0a] border border-[#222222] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white"
            >
              <option value="winRate">Винрейт (%)</option>
              <option value="wins">Победы</option>
              <option value="matchesPlayed">Матчи</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <Card className="border border-[#222222] bg-[#111111] shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center text-[#a1a1aa] animate-pulse text-sm">
              Загрузка таблицы лидеров...
            </div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center text-[#a1a1aa] text-sm">
              Команд по заданным критериям пока нет.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#222222] bg-[#0a0a0a] text-[#52525b] font-mono uppercase text-[11px]">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Команда</th>
                    <th className="py-3 px-3 text-center">Игры</th>
                    <th className="py-3 px-3 text-center">В - Л</th>
                    <th className="py-3 px-3 text-center">Винрейт</th>
                    <th className="py-3 px-3 text-center">Форма</th>
                    <th className="py-3 px-3 text-center">Репутация</th>
                    <th className="py-3 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {teams.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-[#1a1a1a] transition-colors group"
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center">
                          {getRankBadge(t.rank)}
                        </div>
                      </td>

                      {/* Team info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-[#0a0a0a] border border-[#222222] flex items-center justify-center overflow-hidden shrink-0">
                            {t.logoUrl ? (
                              <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-mono font-bold text-xs text-white">
                                {t.tag.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/teams/${t.id}`}
                              className="font-bold text-white text-sm hover:underline transition-colors block"
                            >
                              {t.name}
                            </Link>
                            <span className="text-[11px] font-mono text-[#a1a1aa]">
                              [{t.tag}]
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Matches */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-white">
                        {t.stats.matchesPlayed}
                      </td>

                      {/* W - L */}
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-white font-bold">{t.stats.wins}</span>
                        <span className="text-[#52525b] mx-1">-</span>
                        <span className="text-[#52525b]">{t.stats.losses}</span>
                      </td>

                      {/* Winrate */}
                      <td className="py-3.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={`font-mono font-bold text-xs border-[#222222] bg-[#0a0a0a] ${getWinRateColor(t.stats.winRate)}`}
                        >
                          {t.stats.winRate.toFixed(1)}%
                        </Badge>
                      </td>

                      {/* Form */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center">
                          {renderFormPills(t.stats.form)}
                        </div>
                      </td>

                      {/* Reputation & No-show */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center gap-1 text-white font-bold font-mono">
                            <Star className="w-3.5 h-3.5 fill-[#ffd700] text-[#ffd700]" />
                            <span>{t.rating.average.toFixed(1)}</span>
                          </div>
                          {t.noShowCount > 0 ? (
                            <span className="text-[10px] text-[#ef4444] font-mono">
                              {t.noShowCount} неявок
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#52525b]">
                              ({t.rating.count})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/teams/${t.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs border-[#222222] text-[#a1a1aa] hover:border-white hover:text-white hover:bg-[#1a1a1a]">
                              Профиль
                            </Button>
                          </Link>
                          <Link href={`/scrims/new?targetTeamId=${t.id}`}>
                            <Button variant="cs" size="sm" className="h-7 text-xs gap-1 font-bold">
                              <Swords className="w-3 h-3" />
                              <span>Вызов</span>
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

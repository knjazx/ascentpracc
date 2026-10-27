'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, ShieldAlert, Swords, ChevronRight, Award, Flame } from 'lucide-react';
import Link from 'next/link';

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

export default function LeaderboardPage() {
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [minMatches, setMinMatches] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'winRate' | 'wins' | 'matchesPlayed'>('winRate');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
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
        setTotalPages(data.data.pagination.totalPages);
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
        <span className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-black text-xs shadow-sm">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700 flex items-center justify-center font-bold text-xs">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-7 h-7 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 flex items-center justify-center font-bold text-xs">
          3
        </span>
      );
    }
    return (
      <span className="w-7 h-7 flex items-center justify-center font-mono text-xs text-neutral-500">
        {rank}
      </span>
    );
  };

  const renderFormPills = (formStr: string) => {
    if (!formStr) return <span className="text-xs text-neutral-500">-</span>;
    const chars = formStr.slice(-5).split('');

    return (
      <div className="flex items-center gap-1">
        {chars.map((c, i) => {
          let color = 'bg-neutral-900 text-neutral-500 border border-neutral-800';
          if (c === 'W') color = 'bg-white text-black font-bold';
          if (c === 'L') color = 'bg-neutral-900 text-neutral-500 border border-neutral-800 font-bold';

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
          <p className="text-xs md:text-sm text-neutral-400 mt-1">
            Рейтинг команд по результатам сыгранных праков, статистика побед и репутация
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-border p-1 bg-muted/20 text-xs">
            <button
              onClick={() => { setMinMatches(0); setPage(1); }}
              className={`px-3 py-1 rounded transition-colors ${
                minMatches === 0 ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Все команды
            </button>
            <button
              onClick={() => { setMinMatches(5); setPage(1); }}
              className={`px-3 py-1 rounded transition-colors ${
                minMatches === 5 ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              От 5 матчей
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as 'winRate' | 'wins' | 'matchesPlayed');
                setPage(1);
              }}
              className="bg-muted/40 border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="winRate">Винрейт (%)</option>
              <option value="wins">Победы</option>
              <option value="matchesPlayed">Матчи</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Card */}
      <Card className="border border-border bg-card shadow-xl shadow-black/40 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center text-muted-foreground animate-pulse text-sm">
              Загрузка таблицы лидеров...
            </div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              Команд по заданным критериям пока нет.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-cs-panel text-muted-foreground font-mono uppercase text-[11px]">
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
                <tbody className="divide-y divide-border/40">
                  {teams.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-muted/20 transition-colors group"
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
                          <div className="w-9 h-9 rounded bg-muted/40 border border-border flex items-center justify-center overflow-hidden shrink-0">
                            {t.logoUrl ? (
                              <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-mono font-bold text-xs text-muted-foreground">
                                {t.tag.slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/teams/${t.id}`}
                              className="font-bold text-foreground text-sm hover:text-primary transition-colors block"
                            >
                              {t.name}
                            </Link>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              [{t.tag}]
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Matches */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-foreground">
                        {t.stats.matchesPlayed}
                      </td>

                      {/* W - L */}
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="text-white font-bold">{t.stats.wins}</span>
                        <span className="text-neutral-500 mx-1">-</span>
                        <span className="text-neutral-500">{t.stats.losses}</span>
                      </td>

                      {/* Winrate */}
                      <td className="py-3.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className="font-mono font-bold text-xs border-white/20 text-white bg-white/10"
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
                            <Star className="w-3.5 h-3.5 fill-current text-white" />
                            <span>{t.rating.average.toFixed(1)}</span>
                          </div>
                          {t.noShowCount > 0 ? (
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {t.noShowCount} неявок
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-500">
                              ({t.rating.count})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/teams/${t.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              Профиль
                            </Button>
                          </Link>
                          <Link href={`/scrims/new?targetTeamId=${t.id}`}>
                            <Button size="sm" className="h-7 text-xs gap-1">
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

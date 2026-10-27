'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';
import { Search, Plus, Trophy, Users, Shield, ArrowRight } from 'lucide-react';

interface TeamItem {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  description: string | null;
  avgElo: number | null;
  noShowCount: number;
  totalMatches: number;
  stats: {
    winRate: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
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
  const { user } = useUser();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teams?search=${encodeURIComponent(query)}&limit=24`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeams(data.data.teams);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTeams(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, fetchTeams]);

  return (
    <div className="container py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-wider text-foreground">
            Команды <span className="text-white">CS2 Лиги</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Каталог зарегистрированных команд, открытых для проведения праков и спаррингов.
          </p>
        </div>

        {user && (
          user.teams && user.teams.length >= 1 ? (
            <Link href={`/teams/${user.teams[0].id}`}>
              <Button variant="outline" className="gap-2 font-bold tracking-wider border-white/20 text-white hover:bg-white/10">
                <Users className="w-4 h-4" />
                <span>Моя команда [{user.teams[0].tag}]</span>
              </Button>
            </Link>
          ) : (
            <Link href="/teams/new">
              <Button variant="cs" className="gap-2 font-bold tracking-wider">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Создать команду</span>
              </Button>
            </Link>
          )
        )}
      </div>

      {/* Search Filter Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Поиск по названию или тегу команды..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border focus-visible:ring-neutral-400"
        />
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16 space-y-3 rounded-2xl border border-border bg-card shadow-xl">
          <Shield className="w-12 h-12 text-muted-foreground/60 mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Команды не найдены</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {search ? 'По вашему запросу ничего не нашлось. Попробуйте изменить параметры поиска.' : 'Пока не зарегистрировано ни одной команды. Создайте первую!'}
          </p>
          {user && (
            <Link href="/teams/new" className="inline-block pt-2">
              <Button variant="cs" size="sm">Создать команду</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {teams.map((team) => {
            const winRate = team.stats?.winRate ? Math.round(team.stats.winRate * 100) : 0;
            const matchesCount = team.stats?.matchesPlayed || 0;

            return (
              <Link key={team.id} href={`/teams/${team.id}`} className="group">
                <Card className="h-full border border-border bg-card hover:border-white/50 transition-all duration-200 shadow-xl shadow-black/40 flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    {/* Team Header */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0">
                        {team.logoUrl ? (
                          <Image
                            src={team.logoUrl}
                            alt={team.name}
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <span className="font-mono font-black text-white text-xs">
                            {team.tag}
                          </span>
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-bold text-foreground text-base truncate group-hover:text-white transition-colors">
                            {team.name}
                          </h2>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-neutral-400">
                            [{team.tag}]
                          </span>
                          {team.avgElo && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-neutral-200 bg-white/5 font-mono font-bold">
                              {team.avgElo} ELO
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                      {team.description || 'Команда еще не добавила описание.'}
                    </p>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-neutral-300" />
                        <span className="text-muted-foreground">Винрейт:</span>
                        <span className="font-bold text-foreground">{winRate}%</span>
                      </div>

                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-muted-foreground">Матчей:</span>
                        <span className="font-bold text-foreground">{matchesCount}</span>
                      </div>
                    </div>
                  </CardContent>

                  {/* Footer link hint */}
                  <div className="px-5 py-2.5 border-t border-border bg-black/25 flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-white transition-colors">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {team.managers.length} упр.
                    </span>
                    <span className="flex items-center gap-1 font-semibold">
                      Профиль <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

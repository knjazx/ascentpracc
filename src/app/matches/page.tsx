'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Swords, Search, Calendar, ChevronRight, Trophy, ShieldAlert, Radio } from 'lucide-react';
import Link from 'next/link';
import { formatUtcToZoned } from '@/lib/date';
import { useUser } from '@/hooks/useUser';
import { getClientCache, setClientCache } from '@/lib/client-cache';

interface MatchItem {
  id: string;
  format: 'BO1' | 'BO2' | 'BO3';
  status: 'SCHEDULED' | 'VETO' | 'LIVE' | 'AWAITING_RESULT' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  scheduledAt: string;
  winnerId: string | null;
  teamA: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
  };
  teamB: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
  };
  maps: Array<{
    id: string;
    order: number;
    map: string;
    finalScoreA: number | null;
    finalScoreB: number | null;
  }>;
}

export default function MatchesPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'ALL' | 'LIVE' | 'FINISHED'>('ALL');
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<string>('');
  const [page, setPage] = useState(1);

  const cacheKey = `matches:${activeTab}:${format}:${search}:${page}`;
  const initialCache = getClientCache<{ matches: MatchItem[]; totalPages: number }>(cacheKey);

  const [matches, setMatches] = useState<MatchItem[]>(initialCache?.matches || []);
  const [loading, setLoading] = useState(!initialCache);
  const [totalPages, setTotalPages] = useState(initialCache?.totalPages || 1);

  const fetchMatches = async () => {
    try {
      const key = `matches:${activeTab}:${format}:${search}:${page}`;
      if (!getClientCache(key)) {
        setLoading(true);
      }
      const params = new URLSearchParams();

      if (activeTab === 'LIVE') {
        params.set('status', 'SCHEDULED,VETO,LIVE,AWAITING_RESULT');
      } else if (activeTab === 'FINISHED') {
        params.set('status', 'CONFIRMED,DISPUTED,CANCELLED');
      }

      if (format) params.set('format', format);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('limit', '15');

      const res = await fetch(`/api/matches?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setMatches(data.data.matches);
        const total = data.data.pagination.totalPages;
        setTotalPages(total);
        setClientCache(key, { matches: data.data.matches, totalPages: total });
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [activeTab, format, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMatches();
  };

  const getStatusBadge = (status: MatchItem['status']) => {
    switch (status) {
      case 'LIVE':
        return (
          <Badge className="bg-white/20 text-white border-white/30 flex items-center gap-1 animate-pulse">
            <Radio className="w-3 h-3" />
            <span>LIVE</span>
          </Badge>
        );
      case 'VETO':
        return <Badge variant="outline" className="border-white/30 text-white">Вето карт</Badge>;
      case 'SCHEDULED':
        return <Badge variant="secondary">Запланирован</Badge>;
      case 'AWAITING_RESULT':
        return <Badge className="bg-neutral-800 text-neutral-300 border-neutral-700">Ввод счёта</Badge>;
      case 'CONFIRMED':
        return <Badge className="bg-white/10 text-white border-white/20">Завершен</Badge>;
      case 'DISPUTED':
        return <Badge variant="destructive">Диспут</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="text-muted-foreground">Отменен</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* Title & Stats */}
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222222] pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'ALL' ? 'cs' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab('ALL'); setPage(1); }}
            className={`text-xs h-8 ${activeTab === 'ALL' ? '' : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'}`}
          >
            Все матчи
          </Button>
          <Button
            variant={activeTab === 'LIVE' ? 'cs' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab('LIVE'); setPage(1); }}
            className={`text-xs h-8 ${activeTab === 'LIVE' ? '' : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'}`}
          >
            Live и предстоящие
          </Button>
          <Button
            variant={activeTab === 'FINISHED' ? 'cs' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab('FINISHED'); setPage(1); }}
            className={`text-xs h-8 ${activeTab === 'FINISHED' ? '' : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'}`}
          >
            Завершенные
          </Button>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
          <span>Формат:</span>
          {['', 'BO1', 'BO2', 'BO3'].map((f) => (
            <button
              key={f}
              onClick={() => { setFormat(f); setPage(1); }}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                format === f
                  ? 'bg-white text-black font-bold'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {f || 'Все'}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="py-20 text-center text-[#a1a1aa] animate-pulse text-sm">
          Загрузка списка матчей...
        </div>
      ) : matches.length === 0 ? (
        <Card className="border border-[#222222] bg-[#111111] shadow-xl py-16 text-center">
          <p className="text-[#a1a1aa] text-sm">Матчи не найдены</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const userTimezone = user?.timezone || 'Europe/Kyiv';
            const scheduledFormatted = formatUtcToZoned(m.scheduledAt, userTimezone, 'dd.MM.yyyy HH:mm');

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
              <Card
                key={m.id}
                className="border border-[#222222] bg-[#111111] hover:border-white hover:bg-[#141414] transition-all shadow-xl group"
              >
                <CardContent className="p-4 md:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
                    {/* Date, Format, Status (3 cols) */}
                    <div className="md:col-span-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(m.status)}
                        <Badge variant="outline" className="text-[10px] font-mono border-[#222222] bg-[#0a0a0a] text-white">
                          {m.format}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa] font-mono">
                        <Calendar className="w-3.5 h-3.5 text-white" />
                        <span>{scheduledFormatted}</span>
                      </div>
                    </div>

                    {/* Teams and Scores (7 cols) */}
                    <div className="md:col-span-7 flex items-center justify-between gap-4">
                      {/* Team A */}
                      <div className="flex-1 text-right flex items-center justify-end gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate transition-colors">
                            {m.teamA.name}
                          </p>
                          <span className="text-[11px] font-mono text-[#a1a1aa]">
                            [{m.teamA.tag}]
                          </span>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                          {m.teamA.logoUrl ? (
                            <img src={m.teamA.logoUrl} alt={m.teamA.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold font-mono text-white">
                              {m.teamA.tag.slice(0, 2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score or VS Badge */}
                      <div className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#222222] text-center min-w-[70px]">
                        {m.status === 'CONFIRMED' ? (
                          <div className="text-base font-extrabold font-mono tracking-wider text-white">
                            <span className={seriesWinsA > seriesWinsB ? 'text-[#10b981] font-black' : 'text-[#a1a1aa]'}>
                              {seriesWinsA}
                            </span>
                            <span className="text-[#52525b] mx-1">:</span>
                            <span className={seriesWinsB > seriesWinsA ? 'text-[#10b981] font-black' : 'text-[#a1a1aa]'}>
                              {seriesWinsB}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold font-mono tracking-widest text-[#a1a1aa]">
                            VS
                          </span>
                        )}
                      </div>

                      {/* Team B */}
                      <div className="flex-1 text-left flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                          {m.teamB.logoUrl ? (
                            <img src={m.teamB.logoUrl} alt={m.teamB.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold font-mono text-white">
                              {m.teamB.tag.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate transition-colors">
                            {m.teamB.name}
                          </p>
                          <span className="text-[11px] font-mono text-[#a1a1aa]">
                            [{m.teamB.tag}]
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action link (2 cols) */}
                    <div className="md:col-span-2 flex justify-end">
                      <Link href={`/matches/${m.id}`}>
                        <Button variant="outline" size="sm" className="text-xs gap-1 border-[#222222] text-white hover:bg-white hover:text-black">
                          <span>Детали</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

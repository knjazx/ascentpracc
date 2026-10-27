'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ScrimCard, ScrimCardData } from '@/components/scrims/ScrimCard';
import { ScrimFilters, FilterState } from '@/components/scrims/ScrimFilters';
import { Crosshair, Plus, Users, Zap, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUser } from '@/hooks/useUser';

export default function HomePage() {
  const { user } = useUser();
  const [scrims, setScrims] = useState<ScrimCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    format: 'all',
    platform: 'all',
    serverBy: 'all',
    date: 'all',
  });

  const fetchScrims = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
      });

      if (filters.search) params.set('search', filters.search);
      if (filters.format !== 'all') params.set('format', filters.format);
      if (filters.platform && filters.platform !== 'all') params.set('platform', filters.platform);
      if (filters.serverBy !== 'all') params.set('serverBy', filters.serverBy);
      if (filters.date !== 'all') params.set('date', filters.date);

      const res = await fetch(`/api/scrims?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        setScrims(data.data.scrims);
        setTotalPages(data.data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load scrims feed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchScrims();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchScrims]);

  const handleResetFilters = () => {
    setFilters({
      search: '',
      format: 'all',
      platform: 'all',
      serverBy: 'all',
      date: 'all',
    });
    setPage(1);
  };

  return (
    <div className="container py-8 space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-2xl shadow-black/50">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-cs-panel px-3 py-1 text-xs font-semibold text-neutral-200 font-mono">
              <Zap className="h-3.5 w-3.5 text-white" />
              <span>Платформа соревновательных праков CS2</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight font-mono">
              ASCENT <span className="text-neutral-400">PRACC</span>
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Официальная лига и поиск праков (скримов) по Counter-Strike 2. Интерактивное вето карт, живые лобби, выбор серверов и подтверждение результатов.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/scrims/new">
                <Button variant="cs" size="lg" className="gap-2 text-sm font-bold tracking-wider">
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Создать заявку на прак</span>
                </Button>
              </Link>

              <Link href="/teams">
                <Button variant="outline" size="lg" className="gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>Каталог команд</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Big Ascent Logo in Hero */}
          <div className="hidden md:flex items-center justify-center shrink-0 pr-4">
            <div className="w-36 h-36 rounded-full bg-black border-2 border-border shadow-2xl shadow-black/80 flex items-center justify-center p-1 overflow-hidden">
              <Image
                src="/images/ascent-logo.png"
                alt="Ascent Pracc"
                width={140}
                height={140}
                className="w-full h-full object-cover rounded-full"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Scrim Feed Header & Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-white" />
            <span>Лента открытых заявок</span>
          </h2>

          <span className="text-xs font-mono text-muted-foreground">
            Часовой пояс: <span className="text-foreground font-semibold">{user?.timezone || 'Europe/Kyiv'}</span>
          </span>
        </div>

        <ScrimFilters
          filters={filters}
          onChange={(newFilters) => {
            setFilters(newFilters);
            setPage(1);
          }}
          onReset={handleResetFilters}
        />
      </div>

      {/* Scrims Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-xl border border-border/60 bg-card/60 animate-pulse"
            />
          ))}
        </div>
      ) : scrims.length === 0 ? (
        <div className="text-center py-16 space-y-3 rounded-2xl border border-border/60 bg-card/40">
          <ShieldAlert className="w-12 h-12 text-muted-foreground/60 mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Открытых заявок не найдено</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            По заданным фильтрам нет активных заявок. Попробуйте сбросить фильтры или создайте свою заявку первым.
          </p>
          <div className="pt-2">
            <Link href="/scrims/new">
              <Button variant="cs" size="sm">Создать заявку</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scrims.map((scrim) => (
            <ScrimCard key={scrim.id} scrim={scrim} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Назад</span>
          </Button>

          <span className="text-xs font-mono font-semibold text-muted-foreground">
            Страница {page} из {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="gap-1 text-xs"
          >
            <span>Вперед</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

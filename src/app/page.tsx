'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ScrimCard, ScrimCardData } from '@/components/scrims/ScrimCard';
import { ScrimFilters, FilterState } from '@/components/scrims/ScrimFilters';
import { Plus, Users, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { getClientCache, setClientCache } from '@/lib/client-cache';

export default function HomePage() {
  const { user } = useUser();
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    format: 'all',
    platform: 'all',
    serverBy: 'all',
    date: 'all',
  });

  const cacheKey = `feed:${page}:${filters.search}:${filters.format}:${filters.platform}:${filters.serverBy}:${filters.date}`;
  const initialCache = getClientCache<{ scrims: ScrimCardData[]; totalPages: number }>(cacheKey);

  const [scrims, setScrims] = useState<ScrimCardData[]>(initialCache?.scrims || []);
  const [loading, setLoading] = useState(!initialCache);
  const [totalPages, setTotalPages] = useState(initialCache?.totalPages || 1);

  const fetchScrims = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && !getClientCache(cacheKey)) {
        setLoading(true);
      }
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
        const pages = data.data.pagination.totalPages || 1;
        setTotalPages(pages);
        setClientCache(cacheKey, { scrims: data.data.scrims, totalPages: pages });
      }
    } catch (err) {
      console.error('Failed to load scrims feed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters, cacheKey]);

  useEffect(() => {
    // If user is searching text, debounce; otherwise fetch immediately
    if (filters.search) {
      const timer = setTimeout(() => {
        fetchScrims(false);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      fetchScrims(!initialCache);
    }
  }, [fetchScrims, filters.search, initialCache]);

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
      <section className="relative overflow-hidden rounded-xl border border-[#222222] bg-[#111111] p-6 sm:p-10 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3 sm:space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight font-mono">
              ASCENT <span className="text-[#a1a1aa]">PRACC</span>
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Платформа для поиска праков от ASCENT League
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/scrims/new">
                <Button variant="cs" size="lg" className="gap-2 text-sm font-bold tracking-wider">
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Создать заявку на прак</span>
                </Button>
              </Link>

              <Link href="/teams">
                <Button variant="outline" size="lg" className="gap-2 text-sm border-[#222222] hover:border-white hover:bg-[#1a1a1a]">
                  <Users className="h-4 w-4" />
                  <span>Каталог команд</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Big Ascent Logo in Hero */}
          <div className="hidden md:flex items-center justify-center shrink-0 pr-4 relative select-none">
            <div className="relative w-44 h-40 flex items-center justify-center">
              <Image
                src="/images/ascent-logo.png"
                alt="Ascent Pracc"
                width={176}
                height={160}
                className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Scrim Feed Header & Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
            Лента открытых заявок
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

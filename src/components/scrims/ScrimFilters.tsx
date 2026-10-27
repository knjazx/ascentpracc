'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SERVER_LOCATIONS } from '@/lib/constants/servers';

export interface FilterState {
  search: string;
  format: string;
  platform: string;
  serverBy: string;
  date: string;
}

interface ScrimFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

export function ScrimFilters({ filters, onChange, onReset }: ScrimFiltersProps) {
  const isFiltered =
    Boolean(filters.search) ||
    filters.format !== 'all' ||
    (filters.platform && filters.platform !== 'all') ||
    filters.serverBy !== 'all' ||
    filters.date !== 'all';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xl shadow-black/40">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Поиск по команде или тегу..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9 bg-cs-panel border border-border"
          />
        </div>

        {/* Platform Select */}
        <div>
          <select
            value={filters.platform || 'all'}
            onChange={(e) => onChange({ ...filters, platform: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
          >
            <option value="all">Платформа: Все</option>
            <option value="CYBERSHOCK">Cybershock</option>
            <option value="XPLAY">Xplay</option>
            <option value="FASTCUP">Fastcup</option>
            <option value="OTHER">Другой</option>
          </select>
        </div>

        {/* Format Select */}
        <div>
          <select
            value={filters.format}
            onChange={(e) => onChange({ ...filters, format: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
          >
            <option value="all">Формат: Все</option>
            <option value="BO1">Формат: BO1</option>
            <option value="BO2">Формат: BO2</option>
            <option value="BO3">Формат: BO3</option>
          </select>
        </div>

        {/* Server Select */}
        <div>
          <select
            value={filters.serverBy}
            onChange={(e) => onChange({ ...filters, serverBy: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer font-medium"
          >
            <option value="all">Сервер: Все</option>
            <option value="negotiable">По договоренности</option>
            <optgroup label="Локации серверов" className="bg-neutral-900 text-white font-bold">
              {SERVER_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.city} className="bg-neutral-900 text-neutral-200">
                  {loc.flag} {loc.city}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Date Select */}
        <div className="flex gap-2">
          <select
            value={filters.date}
            onChange={(e) => onChange({ ...filters, date: e.target.value })}
            className="flex h-10 w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer"
          >
            <option value="all">Дата: Любая</option>
            <option value="today">Сегодня</option>
            <option value="tomorrow">Завтра</option>
          </select>

          {isFiltered && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              title="Сбросить фильтры"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

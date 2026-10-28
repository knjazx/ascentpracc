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
    <div className="rounded-lg border border-[#222222] bg-[#111111] p-4 space-y-3 shadow-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Search */}
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525b]" />
          <Input
            type="text"
            placeholder="Поиск по команде или тегу..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9 bg-[#0a0a0a] border border-[#222222] text-white placeholder:text-[#52525b] focus-visible:ring-white focus:border-white"
          />
        </div>

        {/* Platform Select */}
        <div>
          <select
            value={filters.platform || 'all'}
            onChange={(e) => onChange({ ...filters, platform: e.target.value })}
            className="flex h-10 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus:border-white cursor-pointer"
          >
            <option value="all" className="bg-[#111111] text-white">Платформа: Все</option>
            <option value="CYBERSHOCK" className="bg-[#111111] text-white">Cybershock</option>
            <option value="XPLAY" className="bg-[#111111] text-white">Xplay</option>
            <option value="FASTCUP" className="bg-[#111111] text-white">Fastcup</option>
            <option value="OTHER" className="bg-[#111111] text-white">Другой</option>
          </select>
        </div>

        {/* Format Select */}
        <div>
          <select
            value={filters.format}
            onChange={(e) => onChange({ ...filters, format: e.target.value })}
            className="flex h-10 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus:border-white cursor-pointer"
          >
            <option value="all" className="bg-[#111111] text-white">Формат: Все</option>
            <option value="BO1" className="bg-[#111111] text-white">Формат: BO1</option>
            <option value="BO2" className="bg-[#111111] text-white">Формат: BO2</option>
            <option value="BO3" className="bg-[#111111] text-white">Формат: BO3</option>
          </select>
        </div>

        {/* Server Select */}
        <div>
          <select
            value={filters.serverBy}
            onChange={(e) => onChange({ ...filters, serverBy: e.target.value })}
            className="flex h-10 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus:border-white cursor-pointer font-medium"
          >
            <option value="all" className="bg-[#111111] text-white">Сервер: Все</option>
            <option value="negotiable" className="bg-[#111111] text-white">По договоренности</option>
            <optgroup label="Локации серверов" className="bg-[#111111] text-white font-bold">
              {SERVER_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.city} className="bg-[#111111] text-[#a1a1aa]">
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
            className="flex h-10 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus:border-white cursor-pointer"
          >
            <option value="all" className="bg-[#111111] text-white">Дата: Любая</option>
            <option value="today" className="bg-[#111111] text-white">Сегодня</option>
            <option value="tomorrow" className="bg-[#111111] text-white">Завтра</option>
          </select>

          {isFiltered && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onReset}
              title="Сбросить фильтры"
              className="shrink-0 text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

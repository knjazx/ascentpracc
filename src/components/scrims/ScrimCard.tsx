'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';
import { formatSlotDateTime } from '@/lib/date';
import {
  Clock,
  Server,
  Ban,
  MessageSquare,
  ArrowRight,
  ShieldAlert,
  Trophy,
  Globe,
} from 'lucide-react';
import { SERVER_LOCATION_MAP } from '@/lib/constants/servers';
import { FlagIcon } from '@/components/ui/flag-icon';
import { FaceitBadge } from '@/components/ui/FaceitBadge';
import { TeamLogo } from '@/components/ui/TeamLogo';

function getWinRateColor(rate: number) {
  if (rate < 50) return 'text-red-500';
  if (rate === 50) return 'text-[#a1a1aa]';
  return 'text-emerald-400';
}

export interface ScrimCardData {
  id: string;
  isPro?: boolean;
  format: 'BO1' | 'BO2' | 'BO3' | 'BO5';
  platform?: string;
  level: string | null;
  serverBy: 'HOST' | 'GUEST' | 'NEGOTIABLE';
  serverLocations?: string[];
  excludedMaps: string[];
  presetMaps?: string[];
  comment: string | null;
  status: string;
  expiresAt: string;
  responsesCount: number;
  team: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    avgElo?: number | null;
    noShowCount: number;
    isPro?: boolean;
    stats?: {
      winRate: number;
      matchesPlayed: number;
    } | null;
  };
  slots: Array<{
    id: string;
    startsAt: string;
    durationMin: number;
  }>;
}

export const ScrimCard = React.memo(function ScrimCard({ scrim }: { scrim: ScrimCardData }) {
  const { user } = useUser();
  const userTimezone = user?.timezone || 'Europe/Kyiv';

  const serverLabels = {
    HOST: 'Сервер: Наш',
    GUEST: 'Сервер: Соперника',
    NEGOTIABLE: 'Сервер: По договоренности',
  };

  const platformLabels: Record<string, string> = {
    CYBERSHOCK: 'Cybershoke',
    XPLAY: 'Xplay',
    FASTCUP: 'Fastcup',
    OTHER: 'Другой',
  };

  const winRate = scrim.team.stats?.winRate
    ? Math.round(scrim.team.stats.winRate * 100)
    : 0;

  const isProScrim = Boolean(scrim.isPro || scrim.team.isPro);

  return (
    <Card
      className={`transition-all duration-200 shadow-lg relative overflow-hidden flex flex-col justify-between group ${
        isProScrim
          ? 'border-amber-500/50 bg-gradient-to-b from-[#181409] via-[#111111] to-[#0d0d0d] hover:border-amber-400 hover:shadow-amber-950/30'
          : 'border border-[#222222] bg-[#111111] hover:border-white hover:bg-[#141414]'
      }`}
    >
      {isProScrim && (
        <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500/40 via-yellow-400/40 to-transparent h-1" />
      )}
      <CardContent className="p-5 space-y-4">
        {/* Header: Team & Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/teams/${scrim.team.id}`}>
              <div
                className={`relative w-12 h-12 rounded-lg bg-[#0a0a0a] border flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-all ${
                  isProScrim ? 'border-amber-500/40 group-hover:border-amber-400' : 'border-[#222222] group-hover:border-white'
                }`}
              >
                <TeamLogo
                  logoUrl={scrim.team.logoUrl}
                  name={scrim.team.name}
                  tag={scrim.team.tag}
                  size={48}
                />
              </div>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/teams/${scrim.team.id}`}
                  className="font-bold text-base text-white hover:text-white transition-colors truncate max-w-[150px] sm:max-w-[200px]"
                >
                  {scrim.team.name}
                </Link>
                <span className="text-xs font-mono font-semibold text-[#a1a1aa]">
                  [{scrim.team.tag}]
                </span>
                {isProScrim && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    PRO
                  </span>
                )}
                {scrim.team.avgElo && (
                  <FaceitBadge elo={scrim.team.avgElo} size="sm" />
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#a1a1aa] font-mono">
                <span className="flex items-center gap-1 text-white">
                  <Trophy className="w-3 h-3 text-[#ffd700]" />
                  <span className={`font-semibold ${getWinRateColor(winRate)}`}>{winRate}% WR</span>
                </span>
                <span>•</span>
                <span>{scrim.team.stats?.matchesPlayed || 0} игр</span>
                {scrim.team.noShowCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-[#ef4444] flex items-center gap-0.5">
                      <ShieldAlert className="w-3 h-3" />
                      {scrim.team.noShowCount} no-show
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Format Badge & PRO indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isProScrim && (
              <span className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
                ⭐ PRO
              </span>
            )}
            <Badge variant="cs" className="text-xs font-mono font-bold shrink-0">
              {scrim.format}
            </Badge>
          </div>
        </div>

        {/* Level, Platform and Server Info */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-[#161616] text-[#a1a1aa] border border-[#222222] font-semibold flex items-center gap-1">
            <Globe className="w-3 h-3 text-white" />
            <span>{platformLabels[scrim.platform || 'CYBERSHOCK'] || scrim.platform || 'Cybershoke'}</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-[#161616] border border-[#222222] text-[#a1a1aa] flex items-center gap-1.5">
            {scrim.serverLocations && scrim.serverLocations.length > 0 ? (
              <span className="flex items-center gap-1.5">
                {scrim.serverLocations.slice(0, 2).map((city) => {
                  const loc = SERVER_LOCATION_MAP[city];
                  return (
                    <span key={city} className="inline-flex items-center gap-1 text-white">
                      {loc && <FlagIcon country={loc.country} size={14} />}
                      <span>{city}</span>
                    </span>
                  );
                })}
                {scrim.serverLocations.length > 2 && (
                  <span className="text-[10px] text-[#52525b]">+{scrim.serverLocations.length - 2}</span>
                )}
              </span>
            ) : (
              <>
                <Server className="w-3 h-3 text-[#a1a1aa]" />
                <span>{serverLabels[scrim.serverBy] || 'По договоренности'}</span>
              </>
            )}
          </span>

          {scrim.level && (
            <span className="px-2 py-0.5 rounded bg-[#161616] text-[#a1a1aa] border border-[#222222] font-semibold">
              Уровень: {scrim.level}
            </span>
          )}
        </div>

        {/* Available Time Slots */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-mono uppercase text-[#a1a1aa] font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3 text-white" />
            Доступное время ({scrim.slots.length}):
          </span>

          <div className="space-y-1.5">
            {scrim.slots.slice(0, 3).map((slot) => {
              const { dateStr, timeStr, relativeStr } = formatSlotDateTime(
                slot.startsAt,
                userTimezone
              );
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#222222] text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{dateStr}</span>
                    <span className="text-white font-bold">{timeStr}</span>
                  </div>
                  <span className="text-[11px] text-[#a1a1aa]">{relativeStr}</span>
                </div>
              );
            })}

            {scrim.slots.length > 3 && (
              <p className="text-[11px] text-[#52525b] font-mono pl-1">
                + еще {scrim.slots.length - 3} слота...
              </p>
            )}
          </div>
        </div>

        {/* Preset Maps or Excluded Maps */}
        {scrim.presetMaps && scrim.presetMaps.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
            <span className="text-emerald-400 font-bold">
              {scrim.presetMaps.length === 1 ? 'Карта:' : 'Карты:'}
            </span>
            {scrim.presetMaps.map((map, idx) => {
              const rawName = map.replace('de_', '');
              const displayName = rawName === 'dust2' ? 'Dust2' : rawName.charAt(0).toUpperCase() + rawName.slice(1);
              return (
                <span
                  key={map}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/30 text-emerald-300 border border-emerald-500/30"
                >
                  {scrim.presetMaps!.length > 1 && (
                    <span className="text-[10px] text-emerald-400 font-black">#{idx + 1}</span>
                  )}
                  <img
                    src={`/maps/${map}.webp?v=hd1`}
                    alt=""
                    className="w-4 h-2.5 rounded-[2px] object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span>{displayName}</span>
                </span>
              );
            })}
          </div>
        ) : (scrim.excludedMaps?.length ?? 0) > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono text-[#a1a1aa]">
            <Ban className="w-3 h-3 text-[#ef4444]" />
            <span>Исключены:</span>
            {scrim.excludedMaps?.map((map) => {
              const rawName = map.replace('de_', '');
              const displayName = rawName === 'dust2' ? 'Dust2' : rawName.charAt(0).toUpperCase() + rawName.slice(1);
              return (
                <span
                  key={map}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#121212] text-[#a1a1aa] border border-[#242424]"
                >
                  <img
                    src={`/maps/${map}.webp?v=hd1`}
                    alt=""
                    className="w-4 h-2.5 rounded-[2px] object-cover grayscale opacity-60"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span>{displayName}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#71717a]">
            <span>Вето карт в лобби</span>
          </div>
        )}

        {/* Comment preview */}
        {scrim.comment && (
          <p className="text-xs text-[#a1a1aa] italic line-clamp-1 border-l-2 border-white/60 pl-2 bg-[#0a0a0a]/60 py-1 rounded-r">
            «{scrim.comment}»
          </p>
        )}
      </CardContent>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-[#222222] bg-[#0d0d0d] flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[#a1a1aa] font-mono">
          <MessageSquare className="w-3.5 h-3.5 text-white" />
          <span>Откликов:</span>
          <span className="font-bold text-white">{scrim.responsesCount}</span>
        </span>

        <Link href={`/scrims/${scrim.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold border-[#222222] text-white hover:border-white hover:bg-[#1a1a1a] transition-all">
            <span>Подробнее</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      </div>
    </Card>
  );
});

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

export interface ScrimCardData {
  id: string;
  format: 'BO1' | 'BO2' | 'BO3';
  platform?: string;
  level: string | null;
  serverBy: 'HOST' | 'GUEST' | 'NEGOTIABLE';
  serverLocations?: string[];
  excludedMaps: string[];
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

export function ScrimCard({ scrim }: { scrim: ScrimCardData }) {
  const { user } = useUser();
  const userTimezone = user?.timezone || 'Europe/Kyiv';

  const serverLabels = {
    HOST: 'Сервер: Наш',
    GUEST: 'Сервер: Соперника',
    NEGOTIABLE: 'Сервер: По договоренности',
  };

  const platformLabels: Record<string, string> = {
    CYBERSHOCK: 'Cybershock',
    XPLAY: 'Xplay',
    FASTCUP: 'Fastcup',
    OTHER: 'Другой',
  };

  const winRate = scrim.team.stats?.winRate
    ? Math.round(scrim.team.stats.winRate * 100)
    : 0;

  return (
    <Card className="border border-border bg-card hover:border-white/50 transition-all duration-200 shadow-xl shadow-black/40 relative overflow-hidden flex flex-col justify-between group">
      <CardContent className="p-5 space-y-4">
        {/* Header: Team & Badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/teams/${scrim.team.id}`}>
              <div className="relative w-12 h-12 rounded-xl bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                {scrim.team.logoUrl ? (
                  <Image
                    src={scrim.team.logoUrl}
                    alt={scrim.team.name}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="font-mono font-black text-white text-xs">
                    {scrim.team.tag}
                  </span>
                )}
              </div>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/teams/${scrim.team.id}`}
                  className="font-bold text-base text-white hover:text-neutral-300 transition-colors truncate max-w-[150px] sm:max-w-[200px]"
                >
                  {scrim.team.name}
                </Link>
                <span className="text-xs font-mono font-semibold text-neutral-400">
                  [{scrim.team.tag}]
                </span>
                {scrim.team.avgElo && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white bg-white/10 font-mono font-bold">
                    {scrim.team.avgElo} ELO
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 font-mono">
                <span className="flex items-center gap-1 text-white">
                  <Trophy className="w-3 h-3 text-neutral-300" />
                  {winRate}% WR
                </span>
                <span>•</span>
                <span>{scrim.team.stats?.matchesPlayed || 0} игр</span>
                {scrim.team.noShowCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-neutral-300 flex items-center gap-0.5">
                      <ShieldAlert className="w-3 h-3" />
                      {scrim.team.noShowCount} no-show
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Format Badge */}
          <Badge variant="cs" className="text-xs font-mono font-bold shrink-0">
            {scrim.format}
          </Badge>
        </div>

        {/* Level, Platform and Server Info */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 font-semibold flex items-center gap-1">
            <Globe className="w-3 h-3 text-neutral-300" />
            <span>{platformLabels[scrim.platform || 'CYBERSHOCK'] || scrim.platform || 'Cybershock'}</span>
          </span>

          <span className="px-2 py-0.5 rounded bg-cs-panel border border-border text-neutral-300 flex items-center gap-1.5">
            {scrim.serverLocations && scrim.serverLocations.length > 0 ? (
              <span className="flex items-center gap-1.5">
                {scrim.serverLocations.slice(0, 2).map((city) => {
                  const loc = SERVER_LOCATION_MAP[city];
                  return (
                    <span key={city} className="inline-flex items-center gap-1">
                      {loc && <FlagIcon country={loc.country} size={14} />}
                      <span>{city}</span>
                    </span>
                  );
                })}
                {scrim.serverLocations.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">+{scrim.serverLocations.length - 2}</span>
                )}
              </span>
            ) : (
              <>
                <Server className="w-3 h-3 text-neutral-400" />
                <span>{serverLabels[scrim.serverBy] || 'По договоренности'}</span>
              </>
            )}
          </span>

          {scrim.level && (
            <span className="px-2 py-0.5 rounded bg-cs-panel text-neutral-300 border border-border font-semibold">
              Уровень: {scrim.level}
            </span>
          )}
        </div>

        {/* Available Time Slots */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-mono uppercase text-neutral-400 font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3 text-white" />
            Доступные слоты ({scrim.slots.length}):
          </span>

          <div className="space-y-1">
            {scrim.slots.slice(0, 2).map((slot) => {
              const { dateStr, timeStr, relativeStr } = formatSlotDateTime(
                slot.startsAt,
                userTimezone
              );
              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cs-panel border border-border text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{dateStr}</span>
                    <span className="text-white font-bold">{timeStr}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400">{relativeStr}</span>
                </div>
              );
            })}

            {scrim.slots.length > 2 && (
              <p className="text-[11px] text-neutral-400 font-mono pl-1">
                + еще {scrim.slots.length - 2} слота...
              </p>
            )}
          </div>
        </div>

        {/* Excluded Maps */}
        {scrim.excludedMaps.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono text-neutral-400">
            <Ban className="w-3 h-3 text-neutral-400" />
            <span>Исключены:</span>
            {scrim.excludedMaps.map((map) => (
              <span
                key={map}
                className="px-1.5 py-0.2 rounded bg-cs-panel text-neutral-300 border border-border"
              >
                {map.replace('de_', '')}
              </span>
            ))}
          </div>
        )}

        {/* Comment preview */}
        {scrim.comment && (
          <p className="text-xs text-neutral-400 italic line-clamp-1 border-l-2 border-white/40 pl-2">
            «{scrim.comment}»
          </p>
        )}
      </CardContent>

      {/* Card Footer */}
      <div className="px-5 py-3 border-t border-border bg-black/25 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-neutral-400 font-mono">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Откликов:</span>
          <span className="font-bold text-white">{scrim.responsesCount}</span>
        </span>

        <Link href={`/scrims/${scrim.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold hover:border-white">
            <span>Подробнее</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}

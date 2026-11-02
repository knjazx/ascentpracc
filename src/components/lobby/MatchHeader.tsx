'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Swords, Clock, Calendar } from 'lucide-react';
import { formatUtcToLocal } from '@/lib/date';
import { TeamLogo } from '@/components/ui/TeamLogo';

interface TeamSummary {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  avgElo?: number | null;
  stats?: {
    winRate: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
  } | null;
}

interface MatchHeaderProps {
  format: 'BO1' | 'BO2' | 'BO3' | 'BO5';
  platform?: string;
  status: string;
  scheduledAt: string;
  teamA: TeamSummary;
  teamB: TeamSummary;
  userTimezone: string;
}

const platformLabels: Record<string, string> = {
  CYBERSHOCK: 'Cybershoke',
  XPLAY: 'Xplay',
  FASTCUP: 'Fastcup',
  OTHER: 'Другой',
};

export function MatchHeader({
  format,
  platform,
  status,
  scheduledAt,
  teamA,
  teamB,
  userTimezone,
}: MatchHeaderProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    function updateCountdown() {
      const matchTime = new Date(scheduledAt).getTime();
      const diff = matchTime - Date.now();

      if (diff <= 0) {
        setTimeLeft('Матч должен начаться прямо сейчас!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`До матча: ${hours > 0 ? `${hours}ч ` : ''}${minutes}м ${seconds}с`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt]);

  const formattedDate = formatUtcToLocal(scheduledAt, userTimezone, 'd MMMM yyyy, HH:mm');

  const statusMap: Record<string, { label: string; variant: 'default' | 'cs' | 'live' | 'destructive' | 'secondary' }> = {
    SCHEDULED: { label: 'Запланирован', variant: 'cs' },
    VETO: { label: 'Вето карт', variant: 'live' },
    LIVE: { label: 'Идет игра (LIVE)', variant: 'live' },
    AWAITING_RESULT: { label: 'Ожидание счёта', variant: 'cs' },
    CONFIRMED: { label: 'Завершен', variant: 'default' },
    DISPUTED: { label: 'Спорный результат', variant: 'destructive' },
    CANCELLED: { label: 'Отменен', variant: 'secondary' },
  };

  const statusConfig = statusMap[status] || { label: status, variant: 'default' };

  return (
    <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/40 overflow-hidden">
      {/* Background ambient */}
      <div className="absolute top-0 right-1/4 h-32 w-32 bg-white/5 blur-3xl pointer-events-none" />

      {/* Top Bar: Date & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4 mb-6 text-xs font-mono">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-white" />
          <span>{formattedDate} ({userTimezone})</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 font-bold text-xs uppercase">
            {platformLabels[platform || 'CYBERSHOCK'] || platform || 'Cybershoke'}
          </span>
          <span className="flex items-center gap-1.5 text-white font-bold">
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}
          </span>
          <Badge variant={statusConfig.variant} className="text-xs uppercase font-mono">
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Duel presentation */}
      <div className="flex items-center justify-between gap-4">
        {/* Team A (Host) */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-md">
            <TeamLogo
              logoUrl={teamA.logoUrl}
              name={teamA.name}
              tag={teamA.tag}
              size={64}
            />
          </div>

          <div className="overflow-hidden">
            <Link
              href={`/teams/${teamA.id}`}
              className="font-black text-base sm:text-xl text-foreground hover:text-white transition-colors truncate block"
            >
              {teamA.name}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono font-bold text-neutral-400">[{teamA.tag}]</span>
              <span className="text-[10px] uppercase font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-cs-panel border border-border">
                Организатор
              </span>
              {typeof teamA.stats?.winRate === 'number' && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ${
                    teamA.stats.winRate > 0.5
                      ? 'text-emerald-400'
                      : teamA.stats.winRate === 0.5
                      ? 'text-neutral-300'
                      : 'text-rose-400'
                  }`}
                  title={`${teamA.stats.wins} побед, ${teamA.stats.losses} поражений (${teamA.stats.matchesPlayed} матчей)`}
                >
                  WR: {Math.round(teamA.stats.winRate * 100)}%
                </span>
              )}
              {teamA.avgElo && (
                <span className="text-[10px] font-mono font-bold text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                  {teamA.avgElo} ELO
                </span>
              )}
            </div>
          </div>
        </div>

        {/* VS / Format */}
        <div className="flex flex-col items-center justify-center shrink-0 px-2 sm:px-6">
          <div className="w-9 h-9 rounded-full bg-cs-panel border border-border flex items-center justify-center shadow-md">
            <Swords className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-mono font-black text-foreground mt-1 uppercase">
            {format}
          </span>
        </div>

        {/* Team B (Guest) */}
        <div className="flex items-center justify-end gap-3 sm:gap-4 flex-1 text-right">
          <div className="overflow-hidden">
            <Link
              href={`/teams/${teamB.id}`}
              className="font-black text-base sm:text-xl text-foreground hover:text-white transition-colors truncate block"
            >
              {teamB.name}
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-1.5 mt-0.5">
              {teamB.avgElo && (
                <span className="text-[10px] font-mono font-bold text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                  {teamB.avgElo} ELO
                </span>
              )}
              {typeof teamB.stats?.winRate === 'number' && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ${
                    teamB.stats.winRate > 0.5
                      ? 'text-emerald-400'
                      : teamB.stats.winRate === 0.5
                      ? 'text-neutral-300'
                      : 'text-rose-400'
                  }`}
                  title={`${teamB.stats.wins} побед, ${teamB.stats.losses} поражений (${teamB.stats.matchesPlayed} матчей)`}
                >
                  WR: {Math.round(teamB.stats.winRate * 100)}%
                </span>
              )}
              <span className="text-[10px] uppercase font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-cs-panel border border-border">
                Соперник
              </span>
              <span className="text-xs font-mono font-bold text-neutral-400">[{teamB.tag}]</span>
            </div>
          </div>

          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-md">
            <TeamLogo
              logoUrl={teamB.logoUrl}
              name={teamB.name}
              tag={teamB.tag}
              size={64}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

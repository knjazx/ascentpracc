'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Swords, Trophy, Calendar, ArrowLeft, ExternalLink, ShieldCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { formatUtcToZoned } from '@/lib/date';
import { useUser } from '@/hooks/useUser';
import { getClientCache, setClientCache } from '@/lib/client-cache';

interface MatchDetails {
  id: string;
  format: 'BO1' | 'BO2' | 'BO3';
  platform?: string;
  status: string;
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
    pickedBy?: string | null;
    finalScoreA: number | null;
    finalScoreB: number | null;
    scoreA_byA?: number | null;
    scoreB_byA?: number | null;
    scoreA_byB?: number | null;
    scoreB_byB?: number | null;
  }>;
  vetoActions: Array<{
    id: string;
    order: number;
    teamId: string | null;
    type: 'BAN' | 'PICK' | 'SIDE' | 'DECIDER';
    map: string;
    side?: string | null;
  }>;
  ratings?: Array<{
    id: string;
    byTeamId: string;
    punctuality: number;
    sportsmanship: number;
    comment?: string | null;
  }>;
}

export default function MatchDetailPage() {
  const { id } = useParams() as { id: string };
  const { user } = useUser();

  const cacheKey = `match:detail:${id}`;
  const initialCache = getClientCache<MatchDetails>(cacheKey);

  const [match, setMatch] = useState<MatchDetails | null>(initialCache);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatch() {
      try {
        if (!getClientCache(cacheKey)) {
          setLoading(true);
        }
        const directRes = await fetch(`/api/matches/${id}`);
        const data = await directRes.json();

        if (directRes.ok && data.success) {
          setMatch(data.data);
          setClientCache(cacheKey, data.data);
        } else {
          // If user isn't participant, fallback to public matches query
          const fallbackRes = await fetch(`/api/matches`);
          const fbData = await fallbackRes.json();
          const found = fbData.data?.matches?.find((m: MatchDetails) => m.id === id);
          if (found) {
            setMatch(found);
            setClientCache(cacheKey, found);
          } else {
            setError(data.error || 'Матч не найден');
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных матча');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadMatch();
  }, [id, cacheKey]);

  if (loading) {
    return (
      <div className="container py-20 text-center text-muted-foreground animate-pulse text-sm">
        Загрузка матча...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="container py-16 text-center space-y-4 max-w-md">
        <h2 className="text-xl font-bold text-foreground">Матч не найден</h2>
        <p className="text-xs text-muted-foreground">{error || 'Матч не существует или был удален.'}</p>
        <Link href="/matches">
          <Button variant="outline" size="sm">К списку матчей</Button>
        </Link>
      </div>
    );
  }

  const userTimezone = user?.timezone || 'Europe/Kyiv';
  const scheduledDate = formatUtcToZoned(match.scheduledAt, userTimezone, 'dd MMMM yyyy, HH:mm');

  // Count map wins
  let scoreA = 0;
  let scoreB = 0;
  match.maps?.forEach((m) => {
    if (m.finalScoreA !== null && m.finalScoreB !== null) {
      if (m.finalScoreA > m.finalScoreB) scoreA++;
      else if (m.finalScoreB > m.finalScoreA) scoreB++;
    }
  });

  const isCompleted = match.status === 'CONFIRMED';
  const winner = match.winnerId === match.teamA.id ? match.teamA : match.winnerId === match.teamB.id ? match.teamB : null;

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/matches"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Ко всем матчам</span>
        </Link>

        <div className="flex items-center gap-2">
          <a href={`/api/matches/${match.id}/ics`} download>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Календарь (.ics)</span>
            </Button>
          </a>
          <Link href={`/lobby/${match.id}`}>
            <Button size="sm" className="text-xs gap-1.5 h-8">
              <span>Лобби матча</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Scoreboard Header */}
      <Card className="border border-border bg-card shadow-xl shadow-black/40 overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs border-neutral-700">
                {match.format} Series
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-white/20 text-white bg-white/5">
                {match.platform === 'CYBERSHOCK'
                  ? 'Cybershock'
                  : match.platform === 'XPLAY'
                  ? 'Xplay'
                  : match.platform === 'FASTCUP'
                  ? 'Fastcup'
                  : match.platform === 'OTHER'
                  ? 'Другой'
                  : match.platform || 'Cybershock'}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white" />
              {scheduledDate}
            </span>
          </div>

          <div className="grid grid-cols-7 items-center gap-4 py-4">
            {/* Team A */}
            <div className="col-span-3 text-center md:text-right flex flex-col md:flex-row items-center justify-end gap-4">
              <div className="order-2 md:order-1 text-center md:text-right">
                <Link
                  href={`/teams/${match.teamA.id}`}
                  className="text-lg md:text-xl font-extrabold hover:text-white transition-colors block"
                >
                  {match.teamA.name}
                </Link>
                <span className="text-xs font-mono text-muted-foreground">[{match.teamA.tag}]</span>
                {winner?.id === match.teamA.id && (
                  <div className="flex items-center gap-1 justify-center md:justify-end text-xs text-white font-bold mt-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Победитель</span>
                  </div>
                )}
              </div>
              <div className="order-1 md:order-2 w-16 h-16 rounded-lg bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0">
                {match.teamA.logoUrl ? (
                  <img src={match.teamA.logoUrl} alt={match.teamA.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-lg font-mono text-white">{match.teamA.tag.slice(0, 2)}</span>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="col-span-1 text-center">
              {isCompleted ? (
                <div className="text-2xl md:text-4xl font-extrabold font-mono tracking-wider">
                  <span className={scoreA > scoreB ? 'text-white font-black' : 'text-neutral-400'}>{scoreA}</span>
                  <span className="text-neutral-500 mx-1">:</span>
                  <span className={scoreB > scoreA ? 'text-white font-black' : 'text-neutral-400'}>{scoreB}</span>
                </div>
              ) : (
                <span className="text-sm font-bold font-mono text-neutral-300 uppercase px-2 py-1 rounded bg-cs-panel border border-border">
                  {match.status}
                </span>
              )}
            </div>

            {/* Team B */}
            <div className="col-span-3 text-center md:text-left flex flex-col md:flex-row items-center justify-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0">
                {match.teamB.logoUrl ? (
                  <img src={match.teamB.logoUrl} alt={match.teamB.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-lg font-mono text-white">{match.teamB.tag.slice(0, 2)}</span>
                )}
              </div>
              <div className="text-center md:text-left">
                <Link
                  href={`/teams/${match.teamB.id}`}
                  className="text-lg md:text-xl font-extrabold hover:text-white transition-colors block"
                >
                  {match.teamB.name}
                </Link>
                <span className="text-xs font-mono text-muted-foreground">[{match.teamB.tag}]</span>
                {winner?.id === match.teamB.id && (
                  <div className="flex items-center gap-1 justify-center md:justify-start text-xs text-white font-bold mt-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Победитель</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Played Maps Breakdown */}
      {match.maps && match.maps.length > 0 && (
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Swords className="w-4 h-4 text-white" />
              <span>Сыгранные карты серии</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 divide-y divide-border">
            {match.maps.map((m, idx) => {
              const mapScoreA = m.finalScoreA ?? m.scoreA_byA ?? m.scoreA_byB ?? 0;
              const mapScoreB = m.finalScoreB ?? m.scoreB_byA ?? m.scoreB_byB ?? 0;
              const hasScore = m.finalScoreA !== null || m.scoreA_byA !== null;

              return (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-cs-panel text-xs font-mono font-bold flex items-center justify-center text-white border border-border">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground capitalize">{m.map}</p>
                      {m.pickedBy && (
                        <p className="text-[11px] text-muted-foreground">
                          Пик: {m.pickedBy === match.teamA.id ? match.teamA.name : match.teamB.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="font-mono font-bold text-base">
                    {hasScore ? (
                      <div className="flex items-center gap-2">
                        <span className={mapScoreA > mapScoreB ? 'text-white' : 'text-neutral-500'}>
                          {mapScoreA}
                        </span>
                        <span className="text-neutral-500">:</span>
                        <span className={mapScoreB > mapScoreA ? 'text-white' : 'text-neutral-500'}>
                          {mapScoreB}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-normal">Не сыграна</span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Veto History */}
      {match.vetoActions && match.vetoActions.length > 0 && (
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Протокол вето карт
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {match.vetoActions.map((action) => {
                const team = action.teamId === match.teamA.id ? match.teamA : action.teamId === match.teamB.id ? match.teamB : null;
                const isBan = action.type === 'BAN';
                const isPick = action.type === 'PICK';

                return (
                  <div
                    key={action.id}
                    className="p-2.5 rounded-md border border-border bg-cs-panel text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground text-[11px]">#{action.order}</span>
                      <span className="font-bold capitalize">{action.map}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        isBan
                          ? 'border-neutral-700 text-neutral-400 bg-neutral-900'
                          : isPick
                          ? 'border-white/30 text-white bg-white/10'
                          : 'border-white/20 text-neutral-200 bg-white/5'
                      }`}
                    >
                      {team ? `[${team.tag}] ` : ''}
                      {action.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

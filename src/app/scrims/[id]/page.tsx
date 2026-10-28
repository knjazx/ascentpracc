'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatSlotDateTime } from '@/lib/date';
import {
  Crosshair,
  Server,
  Clock,
  Ban,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Swords,
  ArrowRight,
  ShieldAlert,
  Send,
  MessageSquare,
  Trophy,
  Globe,
  Gamepad2,
  Quote,
  MapPin,
} from 'lucide-react';

const ALL_POOL_MAPS = [
  { id: 'de_dust2', name: 'Dust2', image: '/maps/de_dust2.webp' },
  { id: 'de_mirage', name: 'Mirage', image: '/maps/de_mirage.webp' },
  { id: 'de_nuke', name: 'Nuke', image: '/maps/de_nuke.webp' },
  { id: 'de_ancient', name: 'Ancient', image: '/maps/de_ancient.webp' },
  { id: 'de_inferno', name: 'Inferno', image: '/maps/de_inferno.webp' },
  { id: 'de_anubis', name: 'Anubis', image: '/maps/de_anubis.webp' },
  { id: 'de_cache', name: 'Cache', image: '/maps/de_cache.webp' },
  { id: 'de_vertigo', name: 'Vertigo', image: '/maps/de_vertigo.webp' },
];
import { SERVER_LOCATION_MAP } from '@/lib/constants/servers';
import { FlagIcon } from '@/components/ui/flag-icon';
import { getClientCache, setClientCache, clearClientCache } from '@/lib/client-cache';

interface ScrimDetail {
  id: string;
  format: 'BO1' | 'BO2' | 'BO3';
  platform?: string;
  level: string | null;
  serverBy: 'HOST' | 'GUEST' | 'NEGOTIABLE';
  serverLocations?: string[];
  excludedMaps: string[];
  comment: string | null;
  status: 'OPEN' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  isAuthor: boolean;
  targetTeam?: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    avgElo: number | null;
  } | null;
  isTargetManager?: boolean;
  team: {
    id: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    noShowCount: number;
    stats: {
      winRate: number;
      matchesPlayed: number;
    } | null;
  };
  slots: Array<{
    id: string;
    startsAt: string;
    durationMin: number;
  }>;
  match?: { id: string; status: string } | null;
  responses: Array<{
    id: string;
    teamId: string;
    slotId: string | null;
    proposedAt: string | null;
    message: string | null;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
    createdAt: string;
    team: {
      id: string;
      name: string;
      tag: string;
      logoUrl: string | null;
      noShowCount: number;
      stats?: { winRate: number; matchesPlayed: number } | null;
    };
    slot?: { startsAt: string; durationMin: number } | null;
  }>;
}

export default function ScrimDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useUser();
  const userTimezone = user?.timezone || 'Europe/Kyiv';

  const cacheKey = `scrim:detail:${id}`;
  const initialCache = getClientCache<ScrimDetail>(cacheKey);

  const [scrim, setScrim] = useState<ScrimDetail | null>(initialCache);
  const [loading, setLoading] = useState(!initialCache);

  // Response form state (for opponents)
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(initialCache?.slots[0]?.id || '');
  const [proposeCustomTime, setProposeCustomTime] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('20:00');
  const [responseMessage, setResponseMessage] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchScrim = useCallback(async () => {
    try {
      if (!getClientCache(cacheKey)) {
        setLoading(true);
      }
      const res = await fetch(`/api/scrims/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setScrim(data.data);
        setClientCache(cacheKey, data.data);
        if (data.data.slots.length > 0 && !selectedSlotId) {
          setSelectedSlotId(data.data.slots[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load scrim:', err);
    } finally {
      setLoading(false);
    }
  }, [id, cacheKey, selectedSlotId]);

  useEffect(() => {
    fetchScrim();
  }, [fetchScrim]);

  useEffect(() => {
    if (user?.teams && user.teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(user.teams[0].id);
    }
  }, [user, selectedTeamId]);

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingResponse(true);
    setError(null);

    try {
      let proposedAt: string | null = null;
      if (proposeCustomTime) {
        const localDate = new Date(`${customDate}T${customTime}:00`);
        if (isNaN(localDate.getTime())) {
          throw new Error('Укажите корректную дату и время');
        }
        proposedAt = localDate.toISOString();
      }

      const res = await fetch(`/api/scrims/${id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          slotId: proposeCustomTime ? null : selectedSlotId,
          proposedAt,
          message: responseMessage.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке отклика');
      }

      setResponseMessage('');
      await fetchScrim();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить отклик');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleAcceptResponse = async (responseId: string) => {
    if (!confirm('Принять этот отклик и создать матч?')) return;
    setActionLoading(responseId);
    setError(null);

    try {
      const res = await fetch(`/api/scrims/${id}/responses/${responseId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при принятии отклика');
      }
      router.push(`/lobby/${data.data.matchId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка при подтверждении');
      setActionLoading(null);
    }
  };

  const handleDeclineResponse = async (responseId: string) => {
    if (!confirm('Отклонить этот отклик?')) return;
    setActionLoading(responseId);
    setError(null);

    try {
      const res = await fetch(`/api/scrims/${id}/responses/${responseId}/decline`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отклонении отклика');
      }
      await fetchScrim();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawResponse = async (responseId: string) => {
    if (!confirm('Отозвать ваш отклик?')) return;
    setActionLoading(responseId);

    try {
      const res = await fetch(`/api/scrims/${id}/responses/${responseId}/withdraw`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отзыве отклика');
      }
      clearClientCache(`scrim:detail:${id}`);
      clearClientCache('feed:');
      await fetchScrim();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelScrim = async () => {
    if (!confirm('Вы действительно хотите отменить эту заявку на прак?')) return;
    try {
      const res = await fetch(`/api/scrims/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отмене заявки');
      }
      clearClientCache(`scrim:detail:${id}`);
      clearClientCache('feed:');
      setScrim((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleAcceptChallenge = async () => {
    if (!selectedSlotId) {
      setError('Выберите время матча');
      return;
    }
    setActionLoading('accept-challenge');
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlotId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при принятии вызова');
      }
      clearClientCache(`scrim:detail:${id}`);
      clearClientCache('feed:');
      router.push(`/lobby/${data.data.matchId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineChallenge = async () => {
    if (!confirm('Вы уверены, что хотите отклонить/отозвать этот вызов?')) return;
    setActionLoading('decline-challenge');
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${id}/decline`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отклонении вызова');
      }
      clearClientCache(`scrim:detail:${id}`);
      clearClientCache('feed:');
      await fetchScrim();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="container py-12 text-center text-muted-foreground animate-pulse">
        Загрузка данных заявки...
      </div>
    );
  }

  if (!scrim) {
    return (
      <div className="container py-16 text-center space-y-4">
        <h2 className="text-xl font-bold">Заявка не найдена</h2>
        <Link href="/">
          <Button variant="outline">В ленту скримов</Button>
        </Link>
      </div>
    );
  }

  const serverLabels = {
    HOST: 'Сервер организатора (HOST)',
    GUEST: 'Сервер соперника (GUEST)',
    NEGOTIABLE: 'По договоренности',
  };

  const platformLabels: Record<string, string> = {
    CYBERSHOCK: 'Cybershock',
    XPLAY: 'Xplay',
    FASTCUP: 'Fastcup',
    OTHER: 'Другой',
  };

  const isChallenge = Boolean(scrim.targetTeam);

  const statusBadges = {
    OPEN: (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {isChallenge ? 'Вызов ожидает ответа' : 'Открыта'}
      </span>
    ),
    MATCHED: (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
        <Swords className="w-3.5 h-3.5" />
        {isChallenge ? 'Вызов принят' : 'Матч назначен'}
      </span>
    ),
    CANCELLED: (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
        <XCircle className="w-3.5 h-3.5" />
        {isChallenge ? 'Отклонен / Отозван' : 'Отменена'}
      </span>
    ),
    EXPIRED: (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 font-mono text-xs font-bold uppercase tracking-wider">
        <Clock className="w-3.5 h-3.5" />
        Истекла
      </span>
    ),
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Matched Banner */}
      {scrim.status === 'MATCHED' && scrim.match && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/20 bg-neutral-900 shadow-xl shadow-black/40 text-white">
          <div className="flex items-center gap-3">
            <Swords className="w-6 h-6 text-white shrink-0" />
            <div>
              <p className="font-bold text-foreground">Соперник найден! Матч сформирован.</p>
              <p className="text-xs text-neutral-400">Перейдите в лобби матча для чата, вето карт и данных сервера.</p>
            </div>
          </div>
          <Link href={`/lobby/${scrim.match.id}`}>
            <Button variant="cs" size="sm" className="gap-2 font-bold shrink-0">
              <span>В лобби матча</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Direct Challenge Banner */}
      {scrim.targetTeam && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border border-white/20 bg-[#141414] shadow-xl shadow-black/40 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-white" />
          <div className="flex items-center gap-3.5 pl-1">
            <div className="w-11 h-11 rounded-xl bg-[#0a0a0a] border border-[#333333] flex items-center justify-center shrink-0 shadow-md">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded border border-white/20">
                  Прямой вызов
                </span>
                <span className="font-bold text-base text-foreground">
                  Соперник:{' '}
                  <Link href={`/teams/${scrim.targetTeam.id}`} className="text-white hover:underline">
                    [{scrim.targetTeam.tag}] {scrim.targetTeam.name}
                  </Link>
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa] mt-1">
                {scrim.isAuthor
                  ? 'Вы бросили прямой личный вызов. Заявка скрыта из общей ленты и направлена напрямую руководству соперника.'
                  : scrim.isTargetManager
                  ? 'Команда бросила вашей команде прямой вызов! Выберите удобный слот времени и примите матч.'
                  : 'Это приватный прямой вызов между двумя командами.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Link
              href={`/teams/${scrim.targetTeam.id}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-white transition-colors"
            >
              <span className="text-xs font-mono font-bold text-white">[{scrim.targetTeam.tag}]</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Scrim Card */}
      <Card className="border border-[#222222] bg-[#111111] shadow-xl relative overflow-hidden rounded-xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent" />

        <CardHeader className="pb-5 pt-7 px-6 sm:px-8 border-b border-[#222222]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            {/* Host Team Info */}
            <div className="flex items-center gap-4">
              <Link href={`/teams/${scrim.team.id}`}>
                <div className="relative w-16 h-16 rounded-xl bg-[#0a0a0a] border border-[#222222] flex items-center justify-center overflow-hidden shrink-0 shadow-lg group hover:border-white transition-colors">
                  {scrim.team.logoUrl ? (
                    <Image
                      src={scrim.team.logoUrl}
                      alt={scrim.team.name}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                      unoptimized
                    />
                  ) : (
                    <span className="font-mono font-black text-white text-base">
                      {scrim.team.tag}
                    </span>
                  )}
                </div>
              </Link>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Link
                    href={`/teams/${scrim.team.id}`}
                    className="font-black text-2xl text-foreground hover:text-white transition-colors tracking-tight"
                  >
                    {scrim.team.name}
                  </Link>
                  <span className="text-xs font-mono font-bold text-[#a1a1aa] bg-[#161616] px-2 py-0.5 rounded border border-[#222222]">
                    [{scrim.team.tag}]
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <span className="text-[#10b981] font-semibold">
                    Винрейт: {scrim.team.stats?.winRate ? Math.round(scrim.team.stats.winRate * 100) : 0}%
                  </span>
                  <span>•</span>
                  <span>{scrim.team.stats?.matchesPlayed || 0} матчей</span>
                </div>
              </div>
            </div>

            {/* Status & Cancel Action */}
            <div className="flex items-center gap-3">
              {statusBadges[scrim.status]}
              {scrim.isAuthor && scrim.status === 'OPEN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isChallenge ? handleDeclineChallenge : handleCancelScrim}
                  className="text-xs font-semibold text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10 hover:border-[#ef4444]/60 transition-colors"
                >
                  {isChallenge ? 'Отозвать вызов' : 'Отменить заявку'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6 sm:p-8">
          {/* Key Attributes: 4 perfectly balanced, equal-height metric tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg border border-[#222222] bg-[#0a0a0a] flex flex-col justify-between hover:border-white transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider">
                <span>Формат</span>
                <Swords className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="font-mono font-black text-white text-base mt-2">{scrim.format}</p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#222222] bg-[#0a0a0a] flex flex-col justify-between hover:border-white transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider">
                <span>Платформа</span>
                <Gamepad2 className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="font-mono font-bold text-white text-base mt-2 truncate">
                {platformLabels[scrim.platform || 'CYBERSHOCK'] || scrim.platform || 'Cybershock'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#222222] bg-[#0a0a0a] flex flex-col justify-between hover:border-white transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider">
                <span>Уровень</span>
                <Crosshair className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="font-mono font-bold text-white text-base mt-2 truncate">{scrim.level || 'Любой'}</p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#222222] bg-[#0a0a0a] flex flex-col justify-between hover:border-white transition-colors">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider">
                <span>Откликов</span>
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="font-mono font-black text-white text-base mt-2">{scrim.responses.length}</p>
            </div>
          </div>

          {/* Dedicated Server Locations Section (Horizontal Tag Bar) */}
          <div className="p-4 rounded-lg border border-[#222222] bg-[#0a0a0a] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#a1a1aa] uppercase tracking-wider">
                <Globe className="w-4 h-4 text-white" />
                <span>Локации серверов</span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {scrim.serverLocations && scrim.serverLocations.length > 0
                  ? `Выбрано: ${scrim.serverLocations.length}`
                  : 'По договоренности'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-0.5">
              {scrim.serverLocations && scrim.serverLocations.length > 0 ? (
                scrim.serverLocations.map((city) => {
                  const loc = SERVER_LOCATION_MAP[city];
                  return (
                    <div
                      key={city}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111111] border border-[#222222] text-xs font-medium text-white hover:border-white transition-colors shadow-sm"
                    >
                      {loc && <FlagIcon country={loc.country} size={16} />}
                      <span>{city}</span>
                    </div>
                  );
                })
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#111111] border border-[#222222] text-xs font-medium text-[#a1a1aa] font-mono">
                  <span>🤝 {serverLabels[scrim.serverBy] || 'По договоренности'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Slots List */}
          <div className="p-4 rounded-lg border border-[#222222] bg-[#0a0a0a] space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#a1a1aa] uppercase tracking-wider">
              <Clock className="w-4 h-4 text-white" />
              <span>Предложенное время ({scrim.slots.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {scrim.slots.map((s) => {
                const { dateStr, timeStr, relativeStr } = formatSlotDateTime(s.startsAt, userTimezone);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3.5 rounded-md border border-[#222222] bg-[#111111] text-xs font-mono hover:border-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{dateStr}</span>
                      <span className="text-neutral-500">в</span>
                      <span className="font-black text-white text-sm px-2 py-0.5 rounded bg-[#0a0a0a] border border-[#222222]">
                        {timeStr}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#a1a1aa] bg-[#0a0a0a] border border-[#222222] px-2 py-1 rounded">
                      {relativeStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map Pool */}
          <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider border-b border-[#222222] pb-3">
              <div className="flex items-center gap-2 text-white">
                <MapPin className="w-4 h-4 text-white" />
                <span>Маппул встречи</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                <span className="text-white font-bold">{ALL_POOL_MAPS.length - scrim.excludedMaps.length} в пуле</span>
                {scrim.excludedMaps.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-400 font-bold">{scrim.excludedMaps.length} забанено</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 pt-1">
              {ALL_POOL_MAPS.map((map) => {
                const isExcluded = scrim.excludedMaps.includes(map.id);
                return (
                  <div
                    key={map.id}
                    className={`relative flex flex-col items-center p-2 rounded-xl border transition-all select-none ${
                      isExcluded
                        ? 'bg-red-950/25 border-2 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                        : 'bg-[#181818] border border-[#333333]'
                    }`}
                  >
                    {/* Map Thumbnail */}
                    <div
                      className={`relative w-full aspect-[3/2] overflow-hidden rounded-lg border ${
                        isExcluded ? 'border-red-500/40' : 'border-white/10'
                      }`}
                    >
                      <img
                        src={map.image}
                        alt={map.name}
                        className={`w-full h-full object-cover ${
                          isExcluded ? 'grayscale opacity-40 scale-95' : ''
                        }`}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {isExcluded && (
                        <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-0.5">
                          <Ban className="w-5 h-5 text-red-500 stroke-[2.5]" />
                          <span className="text-[9px] font-mono font-black text-red-300 uppercase tracking-wider">
                            БАН
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Map Name */}
                    <span
                      className={`mt-2 pb-0.5 text-xs font-bold tracking-wide transition-colors ${
                        isExcluded ? 'text-red-400 line-through' : 'text-white'
                      }`}
                    >
                      {map.name}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        isExcluded ? 'text-red-400 uppercase' : 'text-[#888888]'
                      }`}
                    >
                      {isExcluded ? 'Забанена' : 'В пуле'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          {scrim.comment && (
            <div className="p-4 rounded-lg border border-[#222222] bg-[#0a0a0a] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#a1a1aa] uppercase tracking-wider">
                <Quote className="w-3.5 h-3.5 text-white" />
                <span>Комментарий организатора</span>
              </div>
              <p className="text-sm text-neutral-200 italic pl-4 border-l-2 border-white/60">
                «{scrim.comment}»
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Author View for Direct Challenge */}
      {scrim.isAuthor && scrim.targetTeam && (
        <Card className="border border-[#222222] bg-[#111111] shadow-xl rounded-xl">
          <CardHeader className="pb-4 border-b border-[#222222]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Swords className="w-5 h-5 text-white shrink-0" />
                <div>
                  <CardTitle className="text-lg">Статус прямого вызова</CardTitle>
                  <CardDescription className="text-xs">
                    Вызов направлен капитану и менеджерам команды{' '}
                    <span className="text-white font-semibold">[{scrim.targetTeam.tag}] {scrim.targetTeam.name}</span>
                  </CardDescription>
                </div>
              </div>
              {scrim.status === 'OPEN' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading === 'decline-challenge'}
                  onClick={handleDeclineChallenge}
                  className="text-xs text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10 hover:border-[#ef4444]/60"
                >
                  {actionLoading === 'decline-challenge' ? 'Отмена...' : 'Отозвать вызов'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {scrim.status === 'OPEN' ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0a0a0a] border border-[#222222] text-xs font-mono text-[#a1a1aa]">
                <Clock className="w-4 h-4 text-white shrink-0 animate-pulse" />
                <span>Ожидает ответа от соперника. Капитан команды уведомлен лично в системе.</span>
              </div>
            ) : scrim.status === 'MATCHED' ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Вызов принят! Матч сформирован и ожидает в лобби.</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-400">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Вызов отклонен или отозван.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Responses Management (Author View for standard open scrims) */}
      {scrim.isAuthor && !scrim.targetTeam && (
        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-white" />
            <span>Отклики команд ({scrim.responses.length})</span>
          </h2>

          {scrim.responses.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-[#222222] bg-[#111111] shadow-xl text-[#a1a1aa] text-sm font-mono">
              Пока нет откликов от соперников. Ссылка на заявку активна в ленте.
            </div>
          ) : (
            <div className="space-y-3">
              {scrim.responses.map((resp) => {
                const isPending = resp.status === 'PENDING';
                let slotInfo = 'Любое время';
                if (resp.slot) {
                  const { dateStr, timeStr } = formatSlotDateTime(resp.slot.startsAt, userTimezone);
                  slotInfo = `Слот: ${dateStr} в ${timeStr}`;
                } else if (resp.proposedAt) {
                  const { dateStr, timeStr } = formatSlotDateTime(resp.proposedAt, userTimezone);
                  slotInfo = `Свое время: ${dateStr} в ${timeStr}`;
                }

                return (
                  <div
                    key={resp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-[#222222] bg-[#111111] shadow-lg hover:border-white transition-all"
                  >
                    {/* Responding Team info */}
                    <div className="flex items-center gap-3.5">
                      <Link href={`/teams/${resp.team.id}`}>
                        <div className="relative w-12 h-12 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                          {resp.team.logoUrl ? (
                            <Image
                              src={resp.team.logoUrl}
                              alt={resp.team.name}
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                              unoptimized
                            />
                          ) : (
                            <span className="font-mono text-xs font-bold text-white">
                              {resp.team.tag}
                            </span>
                          )}
                        </div>
                      </Link>

                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/teams/${resp.team.id}`}
                            className="font-bold text-base text-foreground hover:text-white transition-colors"
                          >
                            {resp.team.name}
                          </Link>
                          <span className="text-xs font-mono font-bold text-[#a1a1aa] bg-[#161616] px-1.5 py-0.5 rounded border border-[#222222]">
                            [{resp.team.tag}]
                          </span>
                        </div>
                        <p className="text-xs font-mono text-white mt-0.5">{slotInfo}</p>
                        {resp.message && (
                          <p className="text-xs text-[#a1a1aa] italic mt-0.5 bg-[#0a0a0a] px-2 py-0.5 rounded border-l-2 border-white/60">
                            «{resp.message}»
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isPending && scrim.status === 'OPEN' ? (
                        <>
                          <Button
                            variant="cs"
                            size="sm"
                            disabled={actionLoading === resp.id}
                            onClick={() => handleAcceptResponse(resp.id)}
                            className="text-xs font-bold gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Принять</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === resp.id}
                            onClick={() => handleDeclineResponse(resp.id)}
                            className="text-xs text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10 hover:border-[#ef4444]/60"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Отклонить</span>
                          </Button>
                        </>
                      ) : (
                        <Badge
                          variant={
                            resp.status === 'ACCEPTED'
                              ? 'live'
                              : resp.status === 'DECLINED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {resp.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Opponent View: Direct Challenge Decision Card */}
      {!scrim.isAuthor && scrim.targetTeam && (
        <Card className="border border-[#222222] bg-[#111111] shadow-xl rounded-xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-[#222222]">
            <CardTitle className="text-lg flex items-center gap-2">
              <Swords className="w-5 h-5 text-white" />
              <span>Прямой вызов вашей команде [{scrim.targetTeam.tag}]</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Команда <span className="text-white font-semibold">{scrim.team.name}</span> бросила вам персональный вызов.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {scrim.status !== 'OPEN' ? (
              <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#222222] text-xs font-mono text-[#a1a1aa] text-center">
                {scrim.status === 'MATCHED'
                  ? 'Вызов уже принят. Перейдите в лобби матча.'
                  : 'Этот вызов больше не активен.'}
              </div>
            ) : !scrim.isTargetManager ? (
              <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#222222] space-y-2 text-center">
                <p className="text-sm font-bold text-foreground">Приватный вызов</p>
                <p className="text-xs text-[#a1a1aa] font-mono">
                  Принять или отклонить этот вызов могут только капитан или менеджеры команды [{scrim.targetTeam.tag}].
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    Выберите предложенное время встречи:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {scrim.slots.map((s) => {
                      const { dateStr, timeStr } = formatSlotDateTime(s.startsAt, userTimezone);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                            selectedSlotId === s.id
                              ? 'border-white bg-white/10 text-foreground ring-1 ring-white/20'
                              : 'border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:text-foreground hover:border-neutral-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="challenge_slot"
                            checked={selectedSlotId === s.id}
                            onChange={() => setSelectedSlotId(s.id)}
                            className="accent-white"
                          />
                          <div>
                            <span className="text-xs font-mono font-bold block text-white">
                              {dateStr}
                            </span>
                            <span className="text-xs font-mono text-[#a1a1aa]">
                              в {timeStr}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <Button
                    variant="cs"
                    size="lg"
                    disabled={actionLoading === 'accept-challenge' || !selectedSlotId}
                    onClick={handleAcceptChallenge}
                    className="w-full sm:w-auto flex-1 gap-2 font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {actionLoading === 'accept-challenge' ? 'Создание матча...' : 'Принять вызов и начать матч'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={actionLoading === 'decline-challenge'}
                    onClick={handleDeclineChallenge}
                    className="w-full sm:w-auto text-[#ef4444] border-[#ef4444]/30 hover:bg-[#ef4444]/10 hover:border-[#ef4444]/60 font-semibold"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    <span>Отклонить вызов</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Opponent View: Respond to Scrim Form (only for standard open scrims) */}
      {!scrim.isAuthor && !scrim.targetTeam && scrim.status === 'OPEN' && (
        <Card className="border border-[#222222] bg-[#111111] shadow-xl rounded-xl">
          <CardHeader className="pb-3 border-b border-[#222222]">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-4 h-4 text-white" />
              <span>Откликнуться на прак</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Выберите свою команду и время, чтобы предложить матч организатору.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {!user ? (
              <div className="py-4 text-center space-y-3">
                <p className="text-xs text-muted-foreground">Войдите через Steam, чтобы отправить отклик.</p>
                <Link href="/api/auth/steam">
                  <Button variant="steam" size="sm">Войти через Steam</Button>
                </Link>
              </div>
            ) : user.teams.length === 0 ? (
              <div className="py-4 text-center space-y-3">
                <p className="text-xs text-muted-foreground">У вас нет зарегистрированных команд для отклика.</p>
                <Link href="/teams/new">
                  <Button variant="cs" size="sm">Создать команду</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSendResponse} className="space-y-4">
                {/* Team selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    От имени какой команды:
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer font-bold"
                  >
                    {user.teams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-neutral-900">
                        {t.name} [{t.tag}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slot choice */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                      Выбор времени встречи:
                    </span>
                    <button
                      type="button"
                      onClick={() => setProposeCustomTime(!proposeCustomTime)}
                      className="text-white hover:underline font-bold"
                    >
                      {proposeCustomTime ? 'Выбрать время организатора' : 'Предложить другое время'}
                    </button>
                  </div>

                  {!proposeCustomTime ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {scrim.slots.map((s) => {
                        const { dateStr, timeStr } = formatSlotDateTime(s.startsAt, userTimezone);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                              selectedSlotId === s.id
                                ? 'border-white bg-white/10 text-foreground ring-1 ring-white/20'
                                : 'border-neutral-800 bg-neutral-900/60 text-muted-foreground hover:text-foreground hover:border-neutral-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="scrim_slot"
                              checked={selectedSlotId === s.id}
                              onChange={() => setSelectedSlotId(s.id)}
                              className="accent-white"
                            />
                            <span className="text-xs font-mono font-semibold">
                              {dateStr} в {timeStr}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60">
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="h-9 px-3 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-foreground"
                        required
                      />
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="h-9 px-3 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-foreground font-mono font-bold"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Optional Message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Сообщение организатору (необязательно)
                  </label>
                  <Input
                    type="text"
                    placeholder="например: наш сервер в Варшаве / готовы сыграть в 21:30"
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    maxLength={500}
                    className="bg-cs-panel border-border"
                  />
                </div>

                <Button
                  type="submit"
                  variant="cs"
                  disabled={submittingResponse}
                  className="w-full gap-2 font-bold tracking-wider"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingResponse ? 'Отправка...' : 'Отправить отклик'}</span>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Opponent's Existing Response Status */}
      {!scrim.isAuthor && !scrim.targetTeam && scrim.responses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Ваш статус отклика на эту заявку:</h3>
          {scrim.responses.map((resp) => (
            <div
              key={resp.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-xl shadow-black/40"
            >
              <div>
                <p className="text-sm font-bold text-foreground">{resp.team.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Статус:{' '}
                  <span className="font-semibold text-white">
                    {resp.status === 'PENDING'
                      ? 'Ожидает рассмотрения организатором'
                      : resp.status}
                  </span>
                </p>
              </div>

              {resp.status === 'PENDING' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleWithdrawResponse(resp.id)}
                  disabled={actionLoading === resp.id}
                  className="text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  Отозвать отклик
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

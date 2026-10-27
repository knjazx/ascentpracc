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
} from 'lucide-react';
import { SERVER_LOCATION_MAP } from '@/lib/constants/servers';
import { FlagIcon } from '@/components/ui/flag-icon';

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

  const [scrim, setScrim] = useState<ScrimDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Response form state (for opponents)
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
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
      setLoading(true);
      const res = await fetch(`/api/scrims/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setScrim(data.data);
        if (data.data.slots.length > 0) {
          setSelectedSlotId(data.data.slots[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load scrim:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      await fetchScrim();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка');
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

  const statusBadges = {
    OPEN: <Badge variant="cs">Открыта</Badge>,
    MATCHED: <Badge variant="live">Матч назначен</Badge>,
    CANCELLED: <Badge variant="destructive">Отменена</Badge>,
    EXPIRED: <Badge variant="secondary">Истекла</Badge>,
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Matched Banner */}
      {scrim.status === 'MATCHED' && scrim.match && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-white/30 bg-card shadow-xl shadow-black/40 text-white">
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

      {/* Main Scrim Card */}
      <Card className="border border-border bg-card shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-700 via-white to-neutral-700" />

        <CardHeader className="pb-4 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Host Team Info */}
            <div className="flex items-center gap-4">
              <Link href={`/teams/${scrim.team.id}`}>
                <div className="relative w-14 h-14 rounded-xl bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {scrim.team.logoUrl ? (
                    <Image
                      src={scrim.team.logoUrl}
                      alt={scrim.team.name}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <span className="font-mono font-black text-white text-sm">
                      {scrim.team.tag}
                    </span>
                  )}
                </div>
              </Link>

              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/teams/${scrim.team.id}`}
                    className="font-bold text-xl text-foreground hover:text-white transition-colors"
                  >
                    {scrim.team.name}
                  </Link>
                  <span className="text-sm font-mono font-bold text-neutral-400">
                    [{scrim.team.tag}]
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                  <span>Винрейт: {scrim.team.stats?.winRate ? Math.round(scrim.team.stats.winRate * 100) : 0}%</span>
                  <span>•</span>
                  <span>{scrim.team.stats?.matchesPlayed || 0} матчей</span>
                </div>
              </div>
            </div>

            {/* Status & Cancel */}
            <div className="flex items-center gap-3">
              {statusBadges[scrim.status]}
              {scrim.isAuthor && scrim.status === 'OPEN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelScrim}
                  className="text-xs text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40"
                >
                  Отменить заявку
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg border border-border bg-cs-panel space-y-1">
              <span className="text-muted-foreground uppercase">Формат</span>
              <p className="font-bold text-foreground text-sm">{scrim.format}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-cs-panel space-y-1">
              <span className="text-muted-foreground uppercase">Платформа</span>
              <p className="font-bold text-white text-sm">{platformLabels[scrim.platform || 'CYBERSHOCK'] || scrim.platform || 'Cybershock'}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-cs-panel space-y-1">
              <span className="text-muted-foreground uppercase">Сервер</span>
              <div className="font-bold text-foreground text-sm truncate flex items-center gap-1.5">
                {scrim.serverLocations && scrim.serverLocations.length > 0 ? (
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {scrim.serverLocations.map((city) => {
                      const loc = SERVER_LOCATION_MAP[city];
                      return (
                        <span key={city} className="inline-flex items-center gap-1">
                          {loc && <FlagIcon country={loc.country} size={14} />}
                          <span>{city}</span>
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span>{serverLabels[scrim.serverBy] || 'По договоренности'}</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-cs-panel space-y-1">
              <span className="text-muted-foreground uppercase">Уровень</span>
              <p className="font-bold text-foreground text-sm">{scrim.level || 'Любой'}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-cs-panel space-y-1">
              <span className="text-muted-foreground uppercase">Откликов</span>
              <p className="font-bold text-white text-sm">{scrim.responses.length}</p>
            </div>
          </div>

          {/* Slots List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white" />
              <span>Предложенные слоты ({scrim.slots.length})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scrim.slots.map((s) => {
                const { dateStr, timeStr, relativeStr } = formatSlotDateTime(s.startsAt, userTimezone);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-cs-panel text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-foreground">{dateStr}</span> в{' '}
                      <span className="font-bold text-white">{timeStr}</span>
                    </div>
                    <span className="text-muted-foreground">{relativeStr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Excluded Maps */}
          {scrim.excludedMaps.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                <span>Исключенные организатором карты</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {scrim.excludedMaps.map((map) => (
                  <span
                    key={map}
                    className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 text-xs font-mono"
                  >
                    {map.replace('de_', '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comment */}
          {scrim.comment && (
            <div className="space-y-1 p-3 rounded-lg border border-border/40 bg-cs-panel/20 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Комментарий организатора:</span>
              <p className="italic">«{scrim.comment}»</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responses Management (Author View) */}
      {scrim.isAuthor && (
        <div className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-white" />
            <span>Отклики команд ({scrim.responses.length})</span>
          </h2>

          {scrim.responses.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-border bg-card shadow-xl text-muted-foreground text-sm">
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-xl shadow-black/40 hover:border-white/50 transition-all"
                  >
                    {/* Responding Team info */}
                    <div className="flex items-center gap-3">
                      <Link href={`/teams/${resp.team.id}`}>
                        <div className="relative w-10 h-10 rounded-lg bg-cs-panel border border-border flex items-center justify-center overflow-hidden shrink-0">
                          {resp.team.logoUrl ? (
                            <Image
                              src={resp.team.logoUrl}
                              alt={resp.team.name}
                              width={40}
                              height={40}
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
                            className="font-bold text-foreground hover:text-white transition-colors"
                          >
                            {resp.team.name}
                          </Link>
                          <span className="text-xs font-mono font-bold text-neutral-400">
                            [{resp.team.tag}]
                          </span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">{slotInfo}</p>
                        {resp.message && (
                          <p className="text-xs text-muted-foreground/80 italic mt-0.5">
                            «{resp.message}»
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
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
                            className="text-xs text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40"
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

      {/* Opponent View: Respond to Scrim Form */}
      {!scrim.isAuthor && scrim.status === 'OPEN' && (
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-4 h-4 text-white" />
              <span>Откликнуться на прак</span>
            </CardTitle>
            <CardDescription>
              Выберите свою команду и слот, чтобы предложить матч организатору.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    От имени какой команды:
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white cursor-pointer font-bold"
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
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                      Выбор времени встречи:
                    </span>
                    <button
                      type="button"
                      onClick={() => setProposeCustomTime(!proposeCustomTime)}
                      className="text-white hover:underline font-bold"
                    >
                      {proposeCustomTime ? 'Выбрать слот организатора' : 'Предложить другое время'}
                    </button>
                  </div>

                  {!proposeCustomTime ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {scrim.slots.map((s) => {
                        const { dateStr, timeStr } = formatSlotDateTime(s.startsAt, userTimezone);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedSlotId === s.id
                                ? 'border-white bg-white/10 text-foreground'
                                : 'border-border bg-cs-panel text-muted-foreground hover:text-foreground'
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
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-cs-panel">
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="h-9 px-3 rounded-md bg-card border border-border text-xs text-foreground"
                        required
                      />
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="h-9 px-3 rounded-md bg-card border border-border text-xs text-foreground font-mono font-bold"
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
      {!scrim.isAuthor && scrim.responses.length > 0 && (
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

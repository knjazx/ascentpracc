'use client';

import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { VetoState } from '@/lib/veto/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Ban,
  CheckCircle2,
  Clock,
  Sparkles,
  Shield,
  Crosshair,
  Swords,
  AlertCircle,
  HelpCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { SideChoice } from '@prisma/client';

const MAP_DISPLAY_NAMES: Record<string, string> = {
  de_dust2: 'Dust2',
  de_mirage: 'Mirage',
  de_nuke: 'Nuke',
  de_ancient: 'Ancient',
  de_inferno: 'Inferno',
  de_anubis: 'Anubis',
  de_cache: 'Cache',
  de_vertigo: 'Vertigo',
  de_overpass: 'Overpass',
  de_train: 'Train',
};

// Map stylized color gradients for esports aesthetics
const MAP_THEMES: Record<string, string> = {
  de_mirage: 'from-neutral-900 via-neutral-950 to-black',
  de_inferno: 'from-neutral-900 via-neutral-950 to-black',
  de_nuke: 'from-neutral-900 via-neutral-950 to-black',
  de_ancient: 'from-neutral-900 via-neutral-950 to-black',
  de_anubis: 'from-neutral-900 via-neutral-950 to-black',
  de_dust2: 'from-neutral-900 via-neutral-950 to-black',
  de_cache: 'from-neutral-900 via-neutral-950 to-black',
  de_vertigo: 'from-neutral-900 via-neutral-950 to-black',
  de_overpass: 'from-neutral-900 via-neutral-950 to-black',
  de_train: 'from-neutral-900 via-neutral-950 to-black',
};

interface VetoBoardProps {
  matchId: string;
  initialState: VetoState | null;
  userTeamRole: 'TEAM_A' | 'TEAM_B' | 'ADMIN';
  teamA: {
    id: string;
    name: string;
    tag: string;
    stats?: {
      winRate?: number;
      mapStats?: Record<string, { winRate: number; played: number; wins: number; losses?: number }>;
    } | null;
  };
  teamB: {
    id: string;
    name: string;
    tag: string;
    stats?: {
      winRate?: number;
      mapStats?: Record<string, { winRate: number; played: number; wins: number; losses?: number }>;
    } | null;
  };
  socket: Socket | null;
}

interface ReadyCheckState {
  matchId: string;
  requestedByRole: 'TEAM_A' | 'TEAM_B';
  requestedByUserName: string;
  requestedByTeamTag: string;
  targetRole: 'TEAM_A' | 'TEAM_B';
  targetTeamTag: string;
  expiresAt: number;
}

export function VetoBoard({
  matchId,
  initialState,
  userTeamRole,
  teamA,
  teamB,
  socket,
}: VetoBoardProps) {
  const [vetoState, setVetoState] = useState<VetoState | null>(initialState);
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyCheck, setReadyCheck] = useState<ReadyCheckState | null>(null);
  const [readySecondsLeft, setReadySecondsLeft] = useState<number>(10);

  // Listen to live socket events
  useEffect(() => {
    if (!socket) return;

    const handleStarted = (newState: VetoState) => {
      setVetoState(newState);
      setReadyCheck(null);
    };

    const handleUpdated = (newState: VetoState) => {
      setVetoState(newState);
      setError(null);
    };

    const handleFinished = (finalState: VetoState) => {
      setVetoState(finalState);
    };

    const handleReadyRequested = (data: ReadyCheckState) => {
      setReadyCheck(data);
      const remaining = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000));
      setReadySecondsLeft(remaining);
      setError(null);
    };

    const handleReadyTimeout = () => {
      setReadyCheck(null);
      setError('Время на подтверждение готовности (10 сек) истекло.');
    };

    const handleReadyDeclined = () => {
      setReadyCheck(null);
      setError('Соперник отклонил запрос на старт вето.');
    };

    socket.on('veto_started', handleStarted);
    socket.on('veto_state_updated', handleUpdated);
    socket.on('veto_finished', handleFinished);
    socket.on('veto_ready_requested', handleReadyRequested);
    socket.on('veto_ready_timeout', handleReadyTimeout);
    socket.on('veto_ready_declined', handleReadyDeclined);

    return () => {
      socket.off('veto_started', handleStarted);
      socket.off('veto_state_updated', handleUpdated);
      socket.off('veto_finished', handleFinished);
      socket.off('veto_ready_requested', handleReadyRequested);
      socket.off('veto_ready_timeout', handleReadyTimeout);
      socket.off('veto_ready_declined', handleReadyDeclined);
    };
  }, [socket]);

  // Ready check 10-second timer countdown
  useEffect(() => {
    if (!readyCheck) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((readyCheck.expiresAt - Date.now()) / 1000));
      setReadySecondsLeft(remaining);
      if (remaining <= 0) {
        setReadyCheck(null);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [readyCheck]);

  // Turn timer countdown (30s)
  useEffect(() => {
    if (!vetoState || vetoState.isFinished || !vetoState.turnExpiresAt) return;

    function updateTimer() {
      const remaining = Math.max(0, Math.ceil((vetoState!.turnExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [vetoState]);

  const handleStartVeto = () => {
    if (!socket) return;
    setSubmitting(true);
    setError(null);
    socket.emit('start_veto', matchId, (res: { success: boolean; error?: string }) => {
      setSubmitting(false);
      if (!res.success) {
        setError(res.error || 'Ошибка старта вето');
      }
    });
  };

  const handleAcceptReady = () => {
    if (!socket || submitting) return;
    setSubmitting(true);
    setError(null);
    socket.emit('accept_veto_ready', matchId, (res: { success: boolean; error?: string }) => {
      setSubmitting(false);
      if (!res.success) {
        setError(res.error || 'Ошибка подтверждения');
      }
    });
  };

  const handleDeclineReady = () => {
    if (!socket) return;
    socket.emit('decline_veto_ready', matchId);
    setReadyCheck(null);
  };

  const handleAction = (mapName?: string, sideChoice?: SideChoice) => {
    if (!socket || submitting) return;
    setSubmitting(true);
    setError(null);

    socket.emit(
      'veto_action',
      { matchId, map: mapName, side: sideChoice },
      (res: { success: boolean; error?: string }) => {
        setSubmitting(false);
        if (!res.success) {
          setError(res.error || 'Ошибка выполнения действия');
        }
      }
    );
  };

  // Check whose turn it is
  const isMyTurn =
    userTeamRole === 'ADMIN' ||
    (vetoState && vetoState.currentTurnRole === userTeamRole);

  const activeTeamName =
    vetoState?.currentTurnRole === 'TEAM_A' ? teamA.name : teamB.name;
  const activeTeamTag =
    vetoState?.currentTurnRole === 'TEAM_A' ? teamA.tag : teamB.tag;

  if (!vetoState || vetoState.status === 'NOT_STARTED') {
    if (readyCheck) {
      const isTarget = userTeamRole === readyCheck.targetRole || userTeamRole === 'ADMIN';
      const isRequester = userTeamRole === readyCheck.requestedByRole;

      return (
        <Card className="border border-border bg-card shadow-2xl p-6 sm:p-8 rounded-xl text-center space-y-5">
          {isTarget ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <h3 className="text-lg sm:text-xl font-black uppercase font-mono tracking-wider text-emerald-400">
                  Соперник готов начать вето карт!
                </h3>
              </div>

              <p className="text-sm text-neutral-300 max-w-md mx-auto">
                Команда <strong className="text-white font-mono">[{readyCheck.requestedByTeamTag}]</strong> ({readyCheck.requestedByUserName}) запросила старт вето.
                Подтвердите готовность вашей команды.
              </p>

              {/* 10s Countdown Bar & Number */}
              <div className="max-w-xs mx-auto space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-neutral-400">Времени на ответ:</span>
                  <span className="text-emerald-400 text-base font-black">{readySecondsLeft} сек</span>
                </div>
                <div className="h-2.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(0, (readySecondsLeft / 10) * 100))}%` }}
                  />
                </div>
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <div className="flex items-center justify-center gap-3 pt-3">
                <Button
                  variant="cs"
                  size="lg"
                  onClick={handleAcceptReady}
                  disabled={submitting}
                  className="gap-2 font-black uppercase tracking-wider text-sm bg-emerald-500 text-black hover:bg-emerald-400 px-8 py-3 shadow-lg shadow-emerald-950/40"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{submitting ? 'Запуск...' : 'Принять (Готов)'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDeclineReady}
                  className="text-xs font-semibold border-neutral-700 text-neutral-400 hover:text-white"
                >
                  <span>Отклонить</span>
                </Button>
              </div>
            </div>
          ) : isRequester ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                <h3 className="text-lg sm:text-xl font-black uppercase font-mono tracking-wider text-amber-400">
                  Ожидание подтверждения соперника...
                </h3>
              </div>

              <p className="text-sm text-neutral-300 max-w-md mx-auto">
                Запрос отправлен команде <strong className="text-white font-mono">[{readyCheck.targetTeamTag}]</strong>. У них есть 10 секунд на подтверждение готовности.
              </p>

              {/* Countdown Bar */}
              <div className="max-w-xs mx-auto space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-neutral-400">Осталось:</span>
                  <span className="text-amber-400 text-base font-black">{readySecondsLeft} сек</span>
                </div>
                <div className="h-2.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-amber-500 transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(0, (readySecondsLeft / 10) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-300">
                Идет подтверждение готовности команд к старту вето ({readySecondsLeft} сек)...
              </p>
            </div>
          )}
        </Card>
      );
    }

    return (
      <Card className="border border-border bg-card shadow-xl shadow-black/40 p-8 text-center space-y-4 rounded-xl">
        <div className="w-14 h-14 rounded-2xl bg-white/10 text-white border border-white/20 flex items-center justify-center mx-auto shadow-lg shadow-white/5">
          <Swords className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase tracking-wider text-foreground">
            Вето соревновательных карт
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Обе команды в лобби. Нажмите кнопку, чтобы отправить подтверждение сопернику. У него будет 10 секунд на принятие.
          </p>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <Button
          variant="cs"
          size="lg"
          onClick={handleStartVeto}
          disabled={submitting}
          className="gap-2 font-bold uppercase tracking-wider text-xs"
        >
          <Sparkles className="w-4 h-4" />
          <span>{submitting ? 'Отправка запроса...' : 'Начать вето (Запрос готовности)'}</span>
        </Button>
      </Card>
    );
  }

  // Timer percentage for animated progress bar (30s)
  const timerPercent = Math.min(100, Math.max(0, (secondsLeft / (vetoState.turnDurationSec || 30)) * 100));

  return (
    <Card className="border border-[#222222] bg-[#111111] overflow-hidden shadow-2xl relative rounded-xl">
      {/* Top Banner: Status & Turn Indicator */}
      <div className="p-4 sm:p-5 border-b border-[#222222] bg-[#0a0a0a]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#111111] border border-[#222222] text-white font-mono font-black text-sm">
              #{vetoState.currentStepIndex + 1}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase font-mono text-white">
                  {vetoState.isPreset
                    ? 'Карты выбраны организатором'
                    : vetoState.isFinished
                    ? 'Вето карт завершено'
                    : `Ход команды [${activeTeamTag}]`}
                </span>
                {!vetoState.isFinished && (
                  <Badge variant={isMyTurn ? 'cs' : 'outline'} className="text-[10px]">
                    {isMyTurn ? 'Ваш ход!' : 'Ожидание соперника'}
                  </Badge>
                )}
              </div>

              <p className="text-xs text-[#a1a1aa] mt-0.5">
                {vetoState.isPreset ? (
                  <span className="text-white font-semibold">
                    Карты прака назначены организатором без вето. Сервер готов к старту матча.
                  </span>
                ) : vetoState.isFinished ? (
                  <span className="text-white font-semibold">
                    Карты утверждены. Сервер готов к старту матча.
                  </span>
                ) : vetoState.currentActionType === 'SIDE' ? (
                  <span>
                    Выбор стороны (CT / T) на карте{' '}
                    <strong className="text-white">
                      {MAP_DISPLAY_NAMES[vetoState.currentTargetMap || ''] || vetoState.currentTargetMap}
                    </strong>
                  </span>
                ) : (
                  <span>
                    Действие:{' '}
                    <strong className="text-white uppercase">
                      {vetoState.currentActionType === 'BAN' ? 'БАН КАРТЫ' : 'ПИК КАРТЫ'}
                    </strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Turn timer */}
          {!vetoState.isFinished && (
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Clock className="w-4 h-4 text-white" />
              <span
                className={`font-mono font-black text-base ${
                  secondsLeft <= 10 ? 'text-[#ef4444] animate-pulse' : 'text-white'
                }`}
              >
                {secondsLeft}с
              </span>
            </div>
          )}
        </div>

        {/* Animated Timer Bar */}
        {!vetoState.isFinished && (
          <div className="h-1.5 w-full bg-[#1a1a1a] rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 ${
                secondsLeft <= 10
                  ? 'bg-[#ef4444]'
                  : 'bg-white'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="m-4 flex items-center gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Side selection prompt if action is SIDE */}
      {!vetoState.isFinished && vetoState.currentActionType === 'SIDE' && (
        <div className="p-6 bg-[#0a0a0a] border-b border-[#222222] text-center space-y-4 animate-in fade-in">
          <h4 className="text-sm font-bold uppercase font-mono tracking-wider text-white">
            Команда [{activeTeamTag}], выберите начальную сторону на карте{' '}
            <span className="text-white font-black underline underline-offset-4">
              {MAP_DISPLAY_NAMES[vetoState.currentTargetMap || ''] || vetoState.currentTargetMap}
            </span>
          </h4>

          {isMyTurn ? (
            <div className="flex justify-center gap-4 max-w-sm mx-auto">
              <Button
                variant="outline"
                size="lg"
                disabled={submitting}
                onClick={() => handleAction(undefined, SideChoice.CT)}
                className="flex-1 border-[#222222] text-white hover:bg-white hover:text-black font-black font-mono uppercase text-base h-12 shadow-sm"
              >
                Начать за CT
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={submitting}
                onClick={() => handleAction(undefined, SideChoice.T)}
                className="flex-1 border-[#222222] text-white hover:bg-white hover:text-black font-black font-mono uppercase text-base h-12 shadow-sm"
              >
                Начать за T
              </Button>
            </div>
          ) : (
            <p className="text-xs text-[#a1a1aa] animate-pulse font-mono">
              Ожидание выбора стороны соперником...
            </p>
          )}
        </div>
      )}

      {/* Maps Grid */}
      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...vetoState.availableMaps, ...vetoState.bannedMaps, ...vetoState.pickedMaps.map((p) => p.map)]
            // Deduplicate maps
            .filter((m, i, arr) => arr.indexOf(m) === i)
            .map((mapName) => {
              const isBanned = vetoState.bannedMaps.includes(mapName);
              const pickedData = vetoState.pickedMaps.find((p) => p.map === mapName);
              const isPicked = Boolean(pickedData);
              const isAvailable = !isBanned && !isPicked;
              const displayName = MAP_DISPLAY_NAMES[mapName] || mapName;
              const theme = MAP_THEMES[mapName] || 'from-zinc-900 to-black';

              const canClickMap =
                !vetoState.isFinished &&
                isMyTurn &&
                isAvailable &&
                (vetoState.currentActionType === 'BAN' || vetoState.currentActionType === 'PICK');

              return (
                <div
                  key={mapName}
                  onClick={() => canClickMap && handleAction(mapName)}
                  className={`group relative rounded-xl border p-2 flex flex-col justify-between overflow-hidden transition-all duration-200 select-none ${
                    isBanned
                      ? 'border-red-500/60 bg-red-950/25 opacity-50 grayscale'
                      : isPicked
                      ? 'border-white bg-[#222222] shadow-md'
                      : canClickMap
                      ? 'border-[#333333] bg-[#181818] hover:border-white hover:bg-[#202020] hover:scale-[1.02] cursor-pointer shadow-sm'
                      : 'border-[#333333] bg-[#181818] opacity-80'
                  }`}
                >
                  {/* Map Thumbnail Image */}
                  <div className="relative w-full aspect-[3/2] overflow-hidden rounded-lg border border-white/10">
                    <img
                      src={`/maps/${mapName}.webp?v=hd1`}
                      alt={displayName}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    {isBanned && (
                      <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-0.5">
                        <Ban className="w-6 h-6 text-red-500 stroke-[2.5]" />
                        <span className="text-[10px] font-mono font-black text-red-300 uppercase tracking-wider">
                          БАН
                        </span>
                      </div>
                    )}
                    {isPicked && pickedData && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white text-black shadow">
                          Карта #{pickedData.order}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Map Name */}
                  <div className="mt-2 text-center">
                    <span className="font-bold text-xs uppercase font-mono tracking-wider text-white">
                      {displayName}
                    </span>
                  </div>

                  {/* Map Winrates */}
                  {(() => {
                    const statsA = teamA.stats?.mapStats?.[mapName];
                    const statsB = teamB.stats?.mapStats?.[mapName];
                    if (!statsA && !statsB) return null;
                    return (
                      <div className="mt-1 flex items-center justify-between text-[10px] font-mono px-1 py-0.5 rounded bg-black/50 border border-white/5">
                        <span className="text-[#a1a1aa] truncate">
                          {teamA.tag}:{' '}
                          <strong className={statsA && statsA.winRate > 0.5 ? 'text-emerald-400' : 'text-neutral-300'}>
                            {statsA && statsA.played > 0 ? `${Math.round(statsA.winRate * 100)}%` : '0%'}
                          </strong>
                        </span>
                        <span className="text-[#a1a1aa] truncate">
                          {teamB.tag}:{' '}
                          <strong className={statsB && statsB.winRate > 0.5 ? 'text-emerald-400' : 'text-neutral-300'}>
                            {statsB && statsB.played > 0 ? `${Math.round(statsB.winRate * 100)}%` : '0%'}
                          </strong>
                        </span>
                      </div>
                    );
                  })()}

                  {/* Status Overlay / CTA */}
                  <div className="pt-2">
                    {isBanned ? (
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#52525b]">
                          <Ban className="w-3.5 h-3.5 text-[#ef4444]" />
                          БАН
                        </span>
                      </div>
                    ) : isPicked && pickedData ? (
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="inline-flex items-center gap-1 text-white font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ПИКНУТА
                        </span>
                        {pickedData.startSideA && (
                          <span className="text-[10px] text-[#a1a1aa] font-semibold">
                            {teamA.tag}: {pickedData.startSideA}
                          </span>
                        )}
                      </div>
                    ) : canClickMap ? (
                      <Button
                        type="button"
                        variant={vetoState.currentActionType === 'BAN' ? 'outline' : 'cs'}
                        size="sm"
                        className="w-full h-7 text-[10px] font-bold uppercase tracking-wider"
                      >
                        {vetoState.currentActionType === 'BAN' ? 'Забанить' : 'Пикнуть'}
                      </Button>
                    ) : (
                      <div className="text-center">
                        <span className="text-[11px] font-mono text-[#52525b]">
                          Доступна
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Veto History Steps Log */}
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            История решений вето:
          </h4>

          {vetoState.actions.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">Ожидание первого действия...</p>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {vetoState.actions.map((act) => {
                const mapDisplay = MAP_DISPLAY_NAMES[act.map] || act.map;
                const isBan = act.type === 'BAN';
                const isPick = act.type === 'PICK';
                const isSide = act.type === 'SIDE';
                const isDecider = act.type === 'DECIDER';

                return (
                  <div
                    key={act.order}
                    className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                      isBan
                        ? 'border-border bg-cs-panel text-neutral-400'
                        : isPick
                        ? 'border-white/30 bg-white/10 text-white'
                        : isDecider
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border-border bg-cs-panel text-neutral-300'
                    }`}
                  >
                    {isDecider ? (
                      <>
                        <span className="font-black text-amber-400">⚔️ ДЕСАЙДЕР:</span>
                        <span className="font-bold text-white">{mapDisplay}</span>
                        <span className="text-[10px] text-neutral-400">(ножевой раунд)</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-[10px] text-muted-foreground">#{act.order}</span>
                        <span className="font-bold text-foreground">
                          [{act.teamRole === 'TEAM_A' ? teamA.tag : teamB.tag}]
                        </span>
                        <span className="uppercase font-bold">{act.type}</span>
                        <span>{mapDisplay}</span>
                        {act.side && <span className="font-bold text-white">({act.side})</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

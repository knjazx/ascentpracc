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
} from 'lucide-react';
import { SideChoice } from '@prisma/client';

const MAP_DISPLAY_NAMES: Record<string, string> = {
  de_mirage: 'Mirage',
  de_inferno: 'Inferno',
  de_nuke: 'Nuke',
  de_ancient: 'Ancient',
  de_anubis: 'Anubis',
  de_dust2: 'Dust II',
  de_overpass: 'Overpass',
  de_vertigo: 'Vertigo',
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
  de_overpass: 'from-neutral-900 via-neutral-950 to-black',
  de_vertigo: 'from-neutral-900 via-neutral-950 to-black',
  de_train: 'from-neutral-900 via-neutral-950 to-black',
};

interface VetoBoardProps {
  matchId: string;
  initialState: VetoState | null;
  userTeamRole: 'TEAM_A' | 'TEAM_B' | 'ADMIN';
  teamA: { id: string; name: string; tag: string };
  teamB: { id: string; name: string; tag: string };
  socket: Socket | null;
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
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen to live socket events
  useEffect(() => {
    if (!socket) return;

    const handleStarted = (newState: VetoState) => {
      setVetoState(newState);
    };

    const handleUpdated = (newState: VetoState) => {
      setVetoState(newState);
      setError(null);
    };

    const handleFinished = (finalState: VetoState) => {
      setVetoState(finalState);
    };

    socket.on('veto_started', handleStarted);
    socket.on('veto_state_updated', handleUpdated);
    socket.on('veto_finished', handleFinished);

    return () => {
      socket.off('veto_started', handleStarted);
      socket.off('veto_state_updated', handleUpdated);
      socket.off('veto_finished', handleFinished);
    };
  }, [socket]);

  // Turn timer countdown
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
    socket.emit('start_veto', matchId, (res: { success: boolean; error?: string }) => {
      setSubmitting(false);
      if (!res.success) {
        setError(res.error || 'Ошибка старта вето');
      }
    });
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
    return (
      <Card className="border border-border bg-card shadow-xl shadow-black/40 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-white/10 text-white border border-white/20 flex items-center justify-center mx-auto shadow-lg shadow-white/5">
          <Swords className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black uppercase tracking-wider text-foreground">
            Вето соревновательных карт
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Обе команды в лобби. Нажмите кнопку ниже, чтобы бросить серверную монетку и начать процедуру банов и пиков.
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
          <span>{submitting ? 'Монетка бросается...' : 'Бросить монетку и начать вето'}</span>
        </Button>
      </Card>
    );
  }

  // Timer percentage for animated progress bar
  const timerPercent = Math.min(100, Math.max(0, (secondsLeft / 60) * 100));

  return (
    <Card className="border border-border bg-card overflow-hidden shadow-2xl shadow-black/40 relative">
      {/* Top Banner: Status & Turn Indicator */}
      <div className="p-4 sm:p-5 border-b border-border bg-cs-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 border border-white/20 text-white font-mono font-black text-sm">
              #{vetoState.currentStepIndex + 1}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold uppercase font-mono text-foreground">
                  {vetoState.isFinished
                    ? 'Вето карт завершено'
                    : `Ход команды [${activeTeamTag}]`}
                </span>
                {!vetoState.isFinished && (
                  <Badge variant={isMyTurn ? 'cs' : 'outline'} className="text-[10px]">
                    {isMyTurn ? 'Ваш ход!' : 'Ожидание соперника'}
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-0.5">
                {vetoState.isFinished ? (
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
                  secondsLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'
                }`}
              >
                {secondsLeft}с
              </span>
            </div>
          )}
        </div>

        {/* Animated Timer Bar */}
        {!vetoState.isFinished && (
          <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 ${
                secondsLeft <= 10
                  ? 'bg-rose-500'
                  : 'bg-white'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="m-4 flex items-center gap-2 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Side selection prompt if action is SIDE */}
      {!vetoState.isFinished && vetoState.currentActionType === 'SIDE' && (
        <div className="p-6 bg-gradient-to-br from-neutral-950 to-black border-b border-neutral-800 text-center space-y-4 animate-in fade-in">
          <h4 className="text-sm font-bold uppercase font-mono tracking-wider text-foreground">
            Команда [{activeTeamTag}], выберите начальную сторону на карте{' '}
            <span className="text-white font-black">
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
                className="flex-1 border-neutral-700 text-white hover:bg-white/10 font-black font-mono uppercase text-base h-12 shadow-lg"
              >
                Начать за CT
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={submitting}
                onClick={() => handleAction(undefined, SideChoice.T)}
                className="flex-1 border-neutral-700 text-white hover:bg-white/10 font-black font-mono uppercase text-base h-12 shadow-lg"
              >
                Начать за T
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground animate-pulse font-mono">
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
                  className={`relative rounded-xl border p-4 min-h-[110px] flex flex-col justify-between overflow-hidden transition-all duration-200 select-none ${
                    isBanned
                      ? 'border-border/50 bg-cs-panel/40 opacity-40 grayscale'
                      : isPicked
                      ? 'border-white/60 bg-white/10 shadow-lg shadow-white/5'
                      : canClickMap
                      ? 'border-border bg-cs-panel hover:border-white hover:scale-[1.02] cursor-pointer shadow-md'
                      : 'border-border/60 bg-cs-panel/60 opacity-80'
                  }`}
                >
                  {/* Map Name & Order Badge */}
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-black text-sm uppercase font-mono tracking-wider text-foreground">
                      {displayName}
                    </span>

                    {isPicked && pickedData && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/20 text-white border border-white/30">
                        Карта #{pickedData.order}
                      </span>
                    )}
                  </div>

                  {/* Status Overlay / CTA */}
                  <div className="pt-2">
                    {isBanned ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-neutral-500">
                        <Ban className="w-3.5 h-3.5" />
                        БАН
                      </span>
                    ) : isPicked && pickedData ? (
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="inline-flex items-center gap-1 text-white font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ПИКНУТА
                        </span>
                        {pickedData.startSideA && (
                          <span className="text-[10px] text-muted-foreground font-semibold">
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
                      <span className="text-[11px] font-mono text-muted-foreground/70">
                        Доступна
                      </span>
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
                        ? 'border-neutral-500 bg-neutral-800 text-neutral-200'
                        : 'border-border bg-cs-panel text-neutral-300'
                    }`}
                  >
                    <span className="font-bold text-[10px] text-muted-foreground">#{act.order}</span>
                    <span className="font-bold text-foreground">[{act.teamRole === 'TEAM_A' ? teamA.tag : teamB.tag}]</span>
                    <span className="uppercase font-bold">{act.type}</span>
                    <span>{mapDisplay}</span>
                    {act.side && <span className="font-bold text-white">({act.side})</span>}
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

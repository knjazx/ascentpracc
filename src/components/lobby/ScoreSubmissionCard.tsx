'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { isValidCS2Score } from '@/lib/validations/score';
import { Trophy, AlertTriangle, CheckCircle } from 'lucide-react';

interface MapInfo {
  id: string;
  order: number;
  map: string;
  pickedBy?: string | null;
  scoreA_byA?: number | null;
  scoreB_byA?: number | null;
  scoreA_byB?: number | null;
  scoreB_byB?: number | null;
  finalScoreA?: number | null;
  finalScoreB?: number | null;
}

interface ScoreSubmissionCardProps {
  matchId: string;
  maps: MapInfo[];
  userTeamRole: 'TEAM_A' | 'TEAM_B' | 'ADMIN';
  teamA: { id: string; name: string; tag: string };
  teamB: { id: string; name: string; tag: string };
  status: string;
  onScoreSubmitted: () => void;
}

export function ScoreSubmissionCard({
  matchId,
  maps,
  userTeamRole,
  teamA,
  teamB,
  status,
  onScoreSubmitted,
}: ScoreSubmissionCardProps) {
  // Local state for score inputs per map
  const [scores, setScores] = useState<Record<string, { scoreA: string; scoreB: string }>>(() => {
    const initial: Record<string, { scoreA: string; scoreB: string }> = {};
    maps.forEach((m) => {
      const prevA = userTeamRole === 'TEAM_A' ? m.scoreA_byA : m.scoreA_byB;
      const prevB = userTeamRole === 'TEAM_A' ? m.scoreB_byA : m.scoreB_byB;
      initial[m.id] = {
        scoreA: prevA !== null && prevA !== undefined ? String(prevA) : '',
        scoreB: prevB !== null && prevB !== undefined ? String(prevB) : '',
      };
    });
    return initial;
  });

  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state if maps change from props
  useEffect(() => {
    setScores((prev) => {
      const next = { ...prev };
      maps.forEach((m) => {
        const prevA = userTeamRole === 'TEAM_A' ? m.scoreA_byA : m.scoreA_byB;
        const prevB = userTeamRole === 'TEAM_A' ? m.scoreB_byA : m.scoreB_byB;
        if (!next[m.id] || (!next[m.id].scoreA && !next[m.id].scoreB)) {
          next[m.id] = {
            scoreA: prevA !== null && prevA !== undefined ? String(prevA) : '',
            scoreB: prevB !== null && prevB !== undefined ? String(prevB) : '',
          };
        }
      });
      return next;
    });
  }, [maps, userTeamRole]);

  if (!maps || maps.length === 0) {
    return null;
  }

  // Only allow score submission during LIVE, AWAITING_RESULT, DISPUTED, or CONFIRMED
  if (!['LIVE', 'AWAITING_RESULT', 'DISPUTED', 'CONFIRMED'].includes(status)) {
    return null;
  }

  const teamASubmitted =
    maps.length > 0 &&
    maps.every(
      (m) =>
        m.scoreA_byA !== null &&
        m.scoreA_byA !== undefined &&
        m.scoreB_byA !== null &&
        m.scoreB_byA !== undefined
    );

  const teamBSubmitted =
    maps.length > 0 &&
    maps.every(
      (m) =>
        m.scoreA_byB !== null &&
        m.scoreA_byB !== undefined &&
        m.scoreB_byB !== null &&
        m.scoreB_byB !== undefined
    );

  const isConfirmed = status === 'CONFIRMED';
  const isDisputed = status === 'DISPUTED';

  const userHasSubmitted =
    justSubmitted ||
    isConfirmed ||
    (userTeamRole === 'TEAM_A' && teamASubmitted) ||
    (userTeamRole === 'TEAM_B' && teamBSubmitted) ||
    (userTeamRole === 'ADMIN' && (teamASubmitted || teamBSubmitted));

  const opponentTag = userTeamRole === 'TEAM_A' ? teamB.tag : teamA.tag;
  const opponentHasSubmitted =
    (userTeamRole === 'TEAM_A' && teamBSubmitted) ||
    (userTeamRole === 'TEAM_B' && teamASubmitted);

  const getDisplayScore = (m: MapInfo) => {
    if (m.finalScoreA !== null && m.finalScoreA !== undefined && m.finalScoreB !== null && m.finalScoreB !== undefined) {
      return { scoreA: m.finalScoreA, scoreB: m.finalScoreB };
    }
    if (userTeamRole === 'TEAM_A' && m.scoreA_byA !== null && m.scoreA_byA !== undefined) {
      return { scoreA: m.scoreA_byA, scoreB: m.scoreB_byA };
    }
    if (userTeamRole === 'TEAM_B' && m.scoreA_byB !== null && m.scoreA_byB !== undefined) {
      return { scoreA: m.scoreA_byB, scoreB: m.scoreB_byB };
    }
    if (scores[m.id]?.scoreA && scores[m.id]?.scoreB) {
      const sa = parseInt(scores[m.id].scoreA, 10);
      const sb = parseInt(scores[m.id].scoreB, 10);
      if (!isNaN(sa) && !isNaN(sb)) {
        return { scoreA: sa, scoreB: sb };
      }
    }
    if (m.scoreA_byA !== null && m.scoreA_byA !== undefined) {
      return { scoreA: m.scoreA_byA, scoreB: m.scoreB_byA };
    }
    if (m.scoreA_byB !== null && m.scoreA_byB !== undefined) {
      return { scoreA: m.scoreA_byB, scoreB: m.scoreB_byB };
    }
    return { scoreA: '-', scoreB: '-' };
  };

  const handleScoreChange = (mapId: string, side: 'scoreA' | 'scoreB', val: string) => {
    setScores((prev) => ({
      ...prev,
      [mapId]: {
        ...prev[mapId],
        [side]: val,
      },
    }));
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка загрузки скриншота');
      }
      setScreenshotUrl(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить скриншот');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const payloadMaps = [];

    for (const m of maps) {
      const s = scores[m.id];
      const scoreA = parseInt(s?.scoreA || '', 10);
      const scoreB = parseInt(s?.scoreB || '', 10);

      if (isNaN(scoreA) || isNaN(scoreB)) {
        setError(`Заполните счёт для карты ${m.map}`);
        return;
      }

      const check = isValidCS2Score(scoreA, scoreB);
      if (!check.valid) {
        setError(`Карта ${m.map}: ${check.reason}`);
        return;
      }

      payloadMaps.push({
        mapId: m.id,
        scoreA,
        scoreB,
      });
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/matches/${matchId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maps: payloadMaps,
          screenshotUrl: screenshotUrl || undefined,
          comment: comment || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке счёта');
      }

      setJustSubmitted(true);
      setSuccessMsg(data.message || 'Счёт успешно отправлен!');
      onScoreSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки счёта');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. IF DISPUTED: show dispute resolution view
  if (isDisputed) {
    return (
      <Card className="border border-rose-500/30 bg-card shadow-xl shadow-black/40">
        <CardHeader className="pb-3 border-b border-rose-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <CardTitle className="text-base font-bold text-foreground">
                Диспут по счёту матча
              </CardTitle>
            </div>
            <Badge variant="destructive" className="flex items-center gap-1">
              <span>Спорный результат</span>
            </Badge>
          </div>
          <CardDescription className="text-xs text-rose-300/80">
            Введенные счета команд не совпали. Матч передан судьям на ручную проверку.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          <div className="space-y-2">
            {maps.map((m, idx) => (
              <div
                key={m.id}
                className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  Карта {idx + 1}: {m.map}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground pt-1">
                  <div>[{teamA.tag}] ввёл: <span className="font-bold text-foreground">{m.scoreA_byA ?? '-'} : {m.scoreB_byA ?? '-'}</span></div>
                  <div>[{teamB.tag}] ввёл: <span className="font-bold text-foreground">{m.scoreA_byB ?? '-'} : {m.scoreB_byB ?? '-'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 2. IF USER HAS ALREADY SUBMITTED (OR CONFIRMED): show clean "Отправлено и всё" view
  if (userHasSubmitted) {
    return (
      <Card className="border border-border bg-card shadow-xl shadow-black/40">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-white" />
              <CardTitle className="text-base font-bold text-foreground">
                Результаты матча
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className={
                isConfirmed
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  : 'border-white/20 text-white bg-white/5'
              }
            >
              {isConfirmed ? 'Подтверждено' : 'Отправлено'}
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            {isConfirmed
              ? 'Результаты подтверждены обеими командами.'
              : 'Счёт зафиксирован и ожидает подтверждения второй команды.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">
                Счёт и результат отправлены
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isConfirmed
                  ? 'Счета обеих команд совпали, матч успешно завершен.'
                  : 'Ожидается подтверждение второй команды.'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {maps.map((m, idx) => {
              const display = getDisplayScore(m);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Карта {idx + 1}: {m.map}
                  </span>

                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="text-foreground">
                      [{teamA.tag}] {display.scoreA}
                    </span>
                    <span className="text-muted-foreground">:</span>
                    <span className="text-foreground">
                      {display.scoreB} [{teamB.tag}]
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 3. IF USER HAS NOT SUBMITTED YET: show score input form
  return (
    <Card className="border border-border bg-card shadow-xl shadow-black/40">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-white" />
            <CardTitle className="text-base font-bold text-foreground">
              Ввод результатов матча
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs border-neutral-700">
            CS2 MR12 / MR3
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          {opponentHasSubmitted
            ? `Команда [${opponentTag}] уже отправила свой результат. Введите ваш финальный счёт карт для подтверждения.`
            : 'Каждая команда вводит финальный счёт сыгранных карт. При совпадении результат подтверждается автоматически.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 text-xs bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-md flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {maps.map((m, idx) => {
              const currentScore = scores[m.id] || { scoreA: '', scoreB: '' };
              const scoreA = parseInt(currentScore.scoreA, 10);
              const scoreB = parseInt(currentScore.scoreB, 10);
              const validation =
                !isNaN(scoreA) && !isNaN(scoreB) ? isValidCS2Score(scoreA, scoreB) : null;

              const opponentEnteredA =
                userTeamRole === 'TEAM_A' ? m.scoreA_byB : m.scoreA_byA;
              const opponentEnteredB =
                userTeamRole === 'TEAM_A' ? m.scoreB_byB : m.scoreB_byA;
              const opponentHasEntered =
                opponentEnteredA !== null && opponentEnteredA !== undefined;

              return (
                <div
                  key={m.id}
                  className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Карта {idx + 1}: {m.map}
                    </span>
                    {opponentHasEntered && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Соперник ввёл: {opponentEnteredA} : {opponentEnteredB}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-5 items-center gap-2">
                    <div className="col-span-2 text-right">
                      <span className="text-xs font-semibold block truncate">
                        [{teamA.tag}] {teamA.name}
                      </span>
                    </div>

                    <div className="col-span-1 flex items-center justify-center gap-1.5">
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={currentScore.scoreA}
                        onChange={(e) => handleScoreChange(m.id, 'scoreA', e.target.value)}
                        placeholder="0"
                        className="w-12 h-9 text-center font-mono font-bold text-sm p-1"
                        required
                      />
                      <span className="font-bold text-muted-foreground">:</span>
                      <Input
                        type="number"
                        min="0"
                        max="99"
                        value={currentScore.scoreB}
                        onChange={(e) => handleScoreChange(m.id, 'scoreB', e.target.value)}
                        placeholder="0"
                        className="w-12 h-9 text-center font-mono font-bold text-sm p-1"
                        required
                      />
                    </div>

                    <div className="col-span-2 text-left">
                      <span className="text-xs font-semibold block truncate">
                        [{teamB.tag}] {teamB.name}
                      </span>
                    </div>
                  </div>

                  {validation && !validation.valid && (
                    <p className="text-[11px] text-rose-400 font-mono text-center">
                      ⚠ {validation.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Screenshot upload & dispute proof */}
          <div className="pt-2 border-t border-border/40 space-y-2">
            <label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Скриншот счёта (рекомендуется)</span>
              {screenshotUrl && (
                <span className="text-[11px] text-emerald-400 font-mono">Файл прикреплен</span>
              )}
            </label>

            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                disabled={uploading}
                className="text-xs h-9"
              />
              {uploading && <span className="text-xs text-muted-foreground animate-pulse">Загрузка...</span>}
            </div>

            <Input
              type="text"
              placeholder="Комментарий к результату (необязательно)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={200}
              className="text-xs h-9"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || uploading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs tracking-wider uppercase h-10 shadow-glow"
          >
            {submitting ? 'Отправка...' : 'Подтвердить и отправить счёт'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

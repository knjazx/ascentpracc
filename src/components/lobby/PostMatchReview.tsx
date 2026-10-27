'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Star, ShieldAlert, Swords, CheckCircle2, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface PostMatchReviewProps {
  matchId: string;
  status: string;
  scheduledAt: string;
  userTeamRole: 'TEAM_A' | 'TEAM_B' | 'ADMIN';
  teamA: { id: string; name: string; tag: string };
  teamB: { id: string; name: string; tag: string };
  onRefresh: () => void;
}

export function PostMatchReview({
  matchId,
  status,
  scheduledAt,
  userTeamRole,
  teamA,
  teamB,
  onRefresh,
}: PostMatchReviewProps) {
  const [punctuality, setPunctuality] = useState<number>(5);
  const [sportsmanship, setSportsmanship] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  const [ratingSaved, setRatingSaved] = useState<boolean>(false);
  const [reportingNoShow, setReportingNoShow] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isConfirmed = status === 'CONFIRMED';
  const isCancelled = status === 'CANCELLED';

  const opponentTeam = userTeamRole === 'TEAM_A' ? teamB : teamA;
  const isManager = userTeamRole === 'TEAM_A' || userTeamRole === 'TEAM_B';

  // Overdue check: 15 minutes after scheduledAt
  const scheduledTime = new Date(scheduledAt).getTime();
  const now = Date.now();
  const isOverdue = now >= scheduledTime + 15 * 60 * 1000;
  const canReportNoShow = isManager && isOverdue && ['SCHEDULED', 'VETO', 'LIVE'].includes(status);

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRating(true);
    setMsg(null);

    try {
      const res = await fetch(`/api/matches/${matchId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          punctuality,
          sportsmanship,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка сохранения отзыва');
      }

      setRatingSaved(true);
      setMsg({ type: 'success', text: 'Спасибо за отзыв! Рейтинг команды соперника обновлен.' });
      onRefresh();
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка отправки отзыва' });
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleNoShow = async () => {
    if (
      !confirm(
        `Зафиксировать техническую неявку команды [${opponentTeam.tag}] ${opponentTeam.name}? Матч будет отменен, жалоба направлена судьям.`
      )
    ) {
      return;
    }

    setReportingNoShow(true);
    setMsg(null);

    try {
      const res = await fetch(`/api/matches/${matchId}/no-show`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка фиксации неявки');
      }

      alert(data.message || 'Неявка соперника зафиксирована.');
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка фиксации неявки');
    } finally {
      setReportingNoShow(false);
    }
  };

  return (
    <Card className="border border-border bg-card shadow-xl shadow-black/40">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white" />
            <span>Действия и календарь</span>
          </CardTitle>
          {isConfirmed && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Матч завершен
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Calendar .ics export */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-cs-panel">
          <div>
            <p className="text-xs font-semibold text-foreground">Синхронизация с календарем</p>
            <p className="text-[11px] text-muted-foreground">
              Добавьте событие в Google Календарь, Apple или Outlook
            </p>
          </div>
          <a href={`/api/matches/${matchId}/ics`} download>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Скачать .ics</span>
            </Button>
          </a>
        </div>

        {/* No-show emergency button */}
        {canReportNoShow && (
          <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Соперник опаздывает больше 15 минут</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Вы можете зафиксировать техническую неявку команды [{opponentTeam.tag}].
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={reportingNoShow}
              onClick={handleNoShow}
              className="text-xs h-8 whitespace-nowrap"
            >
              {reportingNoShow ? 'Фиксация...' : 'Соперник не явился'}
            </Button>
          </div>
        )}

        {/* Post-match ratings and Rematch */}
        {isConfirmed && isManager && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Оценка соперника [{opponentTeam.tag}] {opponentTeam.name}
              </span>
              <Link href={`/scrims/new`}>
                <Button variant="ghost" size="sm" className="text-xs text-primary gap-1 h-7">
                  <Swords className="w-3.5 h-3.5" />
                  <span>Сыграть еще раз</span>
                </Button>
              </Link>
            </div>

            {msg && (
              <div
                className={`p-2.5 rounded text-xs ${
                  msg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                }`}
              >
                {msg.text}
              </div>
            )}

            {!ratingSaved ? (
              <form onSubmit={handleRatingSubmit} className="space-y-3">
                {/* Punctuality stars */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Пунктуальность (вовремя зашли):</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setPunctuality(star)}
                        className="p-1 text-muted-foreground hover:text-white transition-colors"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= punctuality
                              ? 'text-white fill-white'
                              : 'text-neutral-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sportsmanship stars */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Спортивное поведение (уважение):</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setSportsmanship(star)}
                        className="p-1 text-muted-foreground hover:text-white transition-colors"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= sportsmanship
                              ? 'text-white fill-white'
                              : 'text-neutral-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  type="text"
                  placeholder="Отзыв о сопернике (опционально)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={300}
                  className="text-xs h-8"
                />

                <Button
                  type="submit"
                  disabled={submittingRating}
                  size="sm"
                  className="w-full text-xs font-semibold h-8"
                >
                  {submittingRating ? 'Сохранение...' : 'Отправить оценку'}
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-400 p-2 bg-emerald-500/10 rounded">
                <CheckCircle2 className="w-4 h-4" />
                <span>Вы оставили отзыв об этой команде.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

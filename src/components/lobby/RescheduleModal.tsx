'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Check, X, AlertCircle } from 'lucide-react';
import { formatUtcToLocal } from '@/lib/date';

interface RescheduleRequestItem {
  id: string;
  byTeamId: string;
  proposedAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  byTeam?: { tag: string; name: string };
}

interface RescheduleModalProps {
  matchId: string;
  activeRequest: RescheduleRequestItem | null;
  userTeamId: string | null;
  userTimezone: string;
  onRefresh: () => void;
}

export function RescheduleModal({
  matchId,
  activeRequest,
  userTeamId,
  userTimezone,
  onRefresh,
}: RescheduleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProposedByUs = activeRequest && activeRequest.byTeamId === userTeamId;

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const localDate = new Date(`${date}T${time}:00`);
      if (isNaN(localDate.getTime()) || localDate.getTime() <= Date.now()) {
        throw new Error('Укажите корректную дату и время в будущем');
      }

      const res = await fetch(`/api/matches/${matchId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          proposedAt: localDate.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при запросе переноса');
      }

      setIsOpen(false);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (status: 'ACCEPTED' | 'DECLINED') => {
    if (!activeRequest) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/matches/${matchId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          requestId: activeRequest.id,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при ответе на перенос');
      }

      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Active Proposal Banner */}
      {activeRequest && activeRequest.status === 'PENDING' && (
        <Card className="border border-border bg-card shadow-xl shadow-black/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-white shrink-0" />
              <div>
                <p className="font-bold text-foreground">
                  Запрос на перенос матча: {formatUtcToLocal(activeRequest.proposedAt, userTimezone, 'd MMMM HH:mm')}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {isProposedByUs
                    ? 'Вы предложили новое время. Ожидается подтверждение соперника.'
                    : 'Соперник предложил перенести игру на это время.'}
                </p>
              </div>
            </div>

            {!isProposedByUs && (
              <div className="flex items-center gap-2">
                <Button
                  variant="cs"
                  size="sm"
                  disabled={loading}
                  onClick={() => handleRespond('ACCEPTED')}
                  className="h-7 text-xs gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Согласиться</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => handleRespond('DECLINED')}
                  className="h-7 text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Отклонить</span>
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Propose Button & Modal */}
      {!activeRequest && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Запросить перенос времени</span>
          </Button>

          {isOpen && (
            <Card className="border-border bg-card p-4 mt-2">
              <form onSubmit={handlePropose} className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-foreground">Запросить перенос матча</h4>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-8 px-2.5 rounded-md bg-cs-panel border border-input text-xs text-foreground cursor-pointer"
                    required
                  />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-8 px-2.5 rounded-md bg-cs-panel border border-input text-xs text-foreground font-mono font-bold cursor-pointer"
                    required
                  />
                  <Button type="submit" variant="cs" size="sm" disabled={loading} className="h-8 text-xs font-bold">
                    {loading ? 'Отправка...' : 'Отправить запрос'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-8 text-xs">
                    Отмена
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

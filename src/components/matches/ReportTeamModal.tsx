'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Flame,
  MessageSquareWarning,
  UserX,
  Swords,
  AlertTriangle,
  X,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  opponentTeam: {
    id: string;
    name: string;
    tag: string;
  };
  onReportSuccess?: () => void;
}

const REPORT_OPTIONS = [
  {
    key: 'CHEATING',
    title: 'Подозрение в читах',
    desc: 'Использование запрещенного софта, нечестная стрельба, wallhack/aimbot',
    icon: ShieldAlert,
    badgeColor: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
  },
  {
    key: 'ELO_DISCREPANCY',
    title: 'Сильно отличается AVG ELO',
    desc: 'Уровень игры соперника кардинально выше заявленного (смурфинг / буст)',
    icon: Flame,
    badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  {
    key: 'TOXICITY',
    title: 'Токсичность и оскорбления',
    desc: 'Оскорбления в общем чате, паузах или неспортивные провокации',
    icon: MessageSquareWarning,
    badgeColor: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  },
  {
    key: 'NO_SHOW_QUIT',
    title: 'Неявка / Срыв матча',
    desc: 'Опоздание более 15 минут, выход посреди матча, отказ доигрывать',
    icon: UserX,
    badgeColor: 'border-red-500/30 text-red-400 bg-red-500/10',
  },
  {
    key: 'SABOTAGE',
    title: 'Неспортивное поведение / Саботаж',
    desc: 'Грифинг, намеренная помеха игровому процессу или саботаж сервера',
    icon: Swords,
    badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
  },
] as const;

export function ReportTeamModal({
  isOpen,
  onClose,
  matchId,
  opponentTeam,
  onReportSuccess,
}: ReportTeamModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('CHEATING');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (description.trim().length < 10) {
      setError('Пожалуйста, опишите ситуацию подробнее (минимум 10 символов)');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/matches/${matchId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке жалобы');
      }

      setIsSuccess(true);
      if (onReportSuccess) {
        onReportSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить жалобу');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsSuccess(false);
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#222222] bg-[#111111] shadow-2xl p-6 space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#222222] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
                Жалоба на команду
              </h3>
            </div>
            <p className="text-xs text-[#a1a1aa]">
              Соперник:{' '}
              <span className="font-bold text-white">
                [{opponentTeam.tag}] {opponentTeam.name}
              </span>
            </p>
          </div>
          <button
            onClick={handleModalClose}
            className="text-[#71717a] hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-white">Жалоба успешно отправлена</h4>
              <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
                Администрация и судьи лиги проверят запись матча и указанные факты. Спасибо за помощь в поддержании честной игры!
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleModalClose}
              className="mt-2 font-mono text-xs uppercase tracking-wider"
            >
              Закрыть
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-semibold uppercase text-[#a1a1aa]">
                Причина жалобы
              </label>
              <div className="space-y-2">
                {REPORT_OPTIONS.map((opt) => {
                  const isSelected = selectedCategory === opt.key;
                  const Icon = opt.icon;
                  return (
                    <button
                      type="button"
                      key={opt.key}
                      onClick={() => setSelectedCategory(opt.key)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-white bg-[#1a1a1a] shadow-md ring-1 ring-white/20'
                          : 'border-[#222222] bg-[#0c0c0c] hover:border-neutral-600 hover:bg-[#141414]'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${opt.badgeColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold font-mono ${isSelected ? 'text-white' : 'text-[#d4d4d8]'}`}>
                            {opt.title}
                          </span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#71717a] leading-tight">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-semibold uppercase text-[#a1a1aa]">
                  Подробности и таймкоды *
                </label>
                <span className="text-[11px] font-mono text-[#52525b]">
                  {description.length} / 1000
                </span>
              </div>
              <textarea
                rows={3}
                required
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите подозрительные раунды, ники игроков, таймкоды или суть нарушения..."
                className="w-full rounded-xl border border-[#222222] bg-[#0c0c0c] px-3.5 py-2.5 text-xs text-white placeholder:text-[#52525b] focus-visible:outline-none focus-visible:border-white resize-none"
              />
            </div>

            {/* Warning text */}
            <div className="p-2.5 rounded-lg bg-[#0c0c0c] border border-[#1e1e1e] text-[11px] text-[#71717a] flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Заведомо ложные жалобы наказываются штрафом к рейтингу доверия команды.</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleModalClose}
                className="h-9 font-mono text-xs"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={loading || description.trim().length < 10}
                className="h-9 gap-1.5 font-mono text-xs uppercase tracking-wider"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Отправить жалобу</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

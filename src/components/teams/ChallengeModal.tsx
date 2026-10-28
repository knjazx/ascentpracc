'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Swords,
  X,
  Calendar,
  Clock,
  Server,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Handshake,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { SERVER_LOCATIONS } from '@/lib/constants/servers';
import { FlagIcon } from '@/components/ui/flag-icon';

interface SlotItem {
  id: string;
  date: string;
  time: string;
  durationMin: number;
}

interface TargetTeamData {
  id: string;
  name: string;
  tag: string;
  logoUrl?: string | null;
  avgElo?: number | null;
}

interface UserTeamItem {
  id: string;
  name: string;
  tag: string;
}

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTeam: TargetTeamData | null;
  userTeams: UserTeamItem[];
}

export function ChallengeModal({
  isOpen,
  onClose,
  targetTeam,
  userTeams,
}: ChallengeModalProps) {
  const router = useRouter();

  const [challengerTeamId, setChallengerTeamId] = useState(userTeams[0]?.id || '');
  const [format, setFormat] = useState<'BO1' | 'BO2' | 'BO3'>('BO1');
  const [platform, setPlatform] = useState<'CYBERSHOCK' | 'XPLAY' | 'FASTCUP' | 'OTHER'>('CYBERSHOCK');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const serverDropdownRef = React.useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState('');

  // Date constraints: min today, max today + 5 days
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const maxDay = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
  const maxDate = `${maxDay.getFullYear()}-${String(maxDay.getMonth() + 1).padStart(2, '0')}-${String(maxDay.getDate()).padStart(2, '0')}`;

  const targetDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const defaultDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const defaultHour = String(targetDate.getHours()).padStart(2, '0');

  const [slots, setSlots] = useState<SlotItem[]>([
    {
      id: '1',
      date: defaultDate,
      time: `${defaultHour}:00`,
      durationMin: 120,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successChallengeId, setSuccessChallengeId] = useState<string | null>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(event.target as Node)) {
        setIsServerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (userTeams.length > 0 && !challengerTeamId) {
      setChallengerTeamId(userTeams[0].id);
    }
  }, [userTeams, challengerTeamId]);

  if (!isOpen || !targetTeam) return null;

  const toggleLocation = (city: string) => {
    if (selectedLocations.includes(city)) {
      setSelectedLocations(selectedLocations.filter((c) => c !== city));
    } else {
      if (selectedLocations.length >= 4) {
        setError('Можно выбрать не более 4 серверов');
        return;
      }
      setSelectedLocations([...selectedLocations, city]);
    }
  };

  const addSlot = () => {
    if (slots.length >= 3) return;
    setSlots([
      ...slots,
      {
        id: String(Date.now()),
        date: slots[slots.length - 1]?.date || defaultDate,
        time: '21:00',
        durationMin: 120,
      },
    ]);
  };

  const removeSlot = (id: string) => {
    if (slots.length <= 1) return;
    setSlots(slots.filter((s) => s.id !== id));
  };

  const updateSlot = (id: string, field: keyof SlotItem, value: string | number) => {
    setSlots(
      slots.map((s) => {
        if (s.id === id) {
          return { ...s, [field]: value };
        }
        return s;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const activeTeamId = challengerTeamId || userTeams[0]?.id;
    if (!activeTeamId) {
      setError('Выберите команду, от имени которой бросаете вызов');
      setLoading(false);
      return;
    }

    if (activeTeamId === targetTeam.id) {
      setError('Нельзя бросить вызов собственной команде');
      setLoading(false);
      return;
    }

    if (slots.length > 3) {
      setError('Максимум 3 предложения по времени');
      setLoading(false);
      return;
    }

    try {
      const maxFutureTime = Date.now() + 5 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000;
      const formattedSlots = slots.map((s) => {
        const localDate = new Date(`${s.date}T${s.time}:00`);
        if (isNaN(localDate.getTime())) {
          throw new Error('Некорректная дата или время слота');
        }
        if (localDate.getTime() <= Date.now()) {
          throw new Error(`Слот ${s.date} ${s.time} должен быть в будущем`);
        }
        if (localDate.getTime() > maxFutureTime) {
          throw new Error(`Время прака (${s.date} ${s.time}) не может превышать 5 дней от текущего момента`);
        }
        return {
          startsAt: localDate.toISOString(),
          durationMin: Number(s.durationMin),
        };
      });

      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerTeamId: activeTeamId,
          targetTeamId: targetTeam.id,
          format,
          platform,
          serverLocations: selectedLocations,
          slots: formattedSlots,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке вызова');
      }

      setSuccessChallengeId(data.data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла непредвиденная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setError(null);
    setSuccessChallengeId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl border border-[#262626] bg-[#0d0d0d] shadow-2xl overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#222222] bg-[#111111]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shrink-0 shadow-md">
              <Swords className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <span>Бросить прямой вызов</span>
              </h2>
              <p className="text-xs text-[#a1a1aa]">
                Персональный вызов команде{' '}
                <span className="text-white font-bold">
                  [{targetTeam.tag}] {targetTeam.name}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1 custom-scrollbar">
          {successChallengeId ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black uppercase text-white font-mono">
                  Вызов успешно отправлен!
                </h3>
                <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto leading-relaxed">
                  Капитан и управляющие команды{' '}
                  <strong className="text-white">
                    [{targetTeam.tag}] {targetTeam.name}
                  </strong>{' '}
                  получили персональное уведомление. Вы получите ответ, как только они примут или отклонят вызов.
                </p>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button
                  variant="cs"
                  size="sm"
                  onClick={() => {
                    handleResetAndClose();
                    router.push(`/scrims/${successChallengeId}`);
                  }}
                  className="w-full sm:w-auto font-mono text-xs uppercase tracking-wider"
                >
                  <span>Перейти к вызову</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAndClose}
                  className="w-full sm:w-auto font-mono text-xs"
                >
                  Закрыть
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Private Challenge Notice */}
              <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-xs text-amber-200/90 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Это персональный вызов:</strong> Заявка не появится в общей ленте. Сообщение будет доставлено лично капитану команды <span className="font-bold text-white">[{targetTeam.tag}]</span>.
                </div>
              </div>

              {/* Your Team Selector */}
              {userTeams.length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                    Ваша команда *
                  </label>
                  <select
                    value={challengerTeamId}
                    onChange={(e) => setChallengerTeamId(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-xs text-white focus-visible:outline-none focus-visible:border-white cursor-pointer font-bold"
                    required
                  >
                    {userTeams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#141414]">
                        {t.name} [{t.tag}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Format & Platform */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                    Формат встречи *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['BO1', 'BO2', 'BO3'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormat(fmt)}
                        className={`h-9 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                          format === fmt
                            ? 'bg-white text-black font-black'
                            : 'bg-[#141414] border border-[#242424] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                    Платформа *
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="flex h-9 w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-xs text-white focus-visible:outline-none focus-visible:border-white cursor-pointer font-bold"
                  >
                    <option value="CYBERSHOCK" className="bg-[#141414]">Cybershock</option>
                    <option value="XPLAY" className="bg-[#141414]">Xplay</option>
                    <option value="FASTCUP" className="bg-[#141414]">Fastcup</option>
                    <option value="OTHER" className="bg-[#141414]">Другой</option>
                  </select>
                </div>
              </div>

              {/* Server Location Selector */}
              <div className="space-y-2" ref={serverDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                    <Server className="w-3.5 h-3.5 text-white" />
                    <span>Локация сервера</span>
                  </label>
                  <span className="text-[10px] text-[#71717a] font-mono">
                    {selectedLocations.length === 0 ? 'По договоренности' : `${selectedLocations.length}/4`}
                  </span>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsServerDropdownOpen((prev) => !prev)}
                    className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:border-[#444444] transition-all flex items-center justify-between gap-2 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      {selectedLocations.length === 0 ? (
                        <div className="flex items-center gap-2">
                          <Handshake className="w-3.5 h-3.5 text-[#71717a]" />
                          <span className="text-xs font-semibold text-white">По договоренности</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {selectedLocations.map((city) => {
                            const loc = SERVER_LOCATIONS.find((l) => l.city === city);
                            return (
                              <span
                                key={city}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c1c1c] border border-[#333333] text-[11px] font-medium text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLocation(city);
                                }}
                              >
                                {loc && <FlagIcon country={loc.country} size={12} />}
                                <span>{city}</span>
                                <X className="w-3 h-3 text-[#71717a] hover:text-white" />
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#71717a] transition-transform ${
                        isServerDropdownOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>

                  {/* Floating Menu */}
                  {isServerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-[#2a2a2a] bg-[#111111] shadow-2xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#222222]">
                        <span className="text-[11px] font-mono text-[#a1a1aa]">Выберите серверы:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedLocations([])}
                          className="text-[10px] text-white hover:underline font-mono"
                        >
                          По договоренности
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {SERVER_LOCATIONS.map((loc) => {
                          const isChecked = selectedLocations.includes(loc.city);
                          return (
                            <div
                              key={loc.id}
                              onClick={() => toggleLocation(loc.city)}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                                isChecked
                                  ? 'border-white bg-[#1c1c1c] text-white font-bold'
                                  : 'border-[#222222] bg-[#141414] text-[#a1a1aa] hover:border-[#383838]'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FlagIcon country={loc.country} size={16} />
                                <span className="truncate">{loc.city}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Time Slots (1-3 slots, max 5 days) */}
              <div className="space-y-2.5 p-3.5 rounded-xl border border-[#242424] bg-[#090909]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-white" />
                      <span>Варианты времени</span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[#141414] border border-[#242424] text-[#a1a1aa]">
                      {slots.length}/3
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSlot}
                    disabled={slots.length >= 3}
                    className="h-7 text-[11px] gap-1 font-mono"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Время</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  {slots.map((slot, index) => (
                    <div
                      key={slot.id}
                      className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-lg border border-[#222222] bg-[#141414]"
                    >
                      <span className="text-xs font-mono font-bold text-white w-5 text-center">
                        #{index + 1}
                      </span>

                      <input
                        type="date"
                        value={slot.date}
                        min={minDate}
                        max={maxDate}
                        onChange={(e) => updateSlot(slot.id, 'date', e.target.value)}
                        className="h-8 px-2.5 rounded-md bg-[#0a0a0a] border border-[#262626] text-xs text-white cursor-pointer w-full sm:w-auto focus:border-white outline-none"
                        required
                      />

                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => updateSlot(slot.id, 'time', e.target.value)}
                        className="h-8 px-2.5 rounded-md bg-[#0a0a0a] border border-[#262626] text-xs text-white cursor-pointer font-mono font-bold w-full sm:w-auto focus:border-white outline-none"
                        required
                      />

                      <select
                        value={slot.durationMin}
                        onChange={(e) => updateSlot(slot.id, 'durationMin', Number(e.target.value))}
                        className="h-8 px-2 rounded-md bg-[#0a0a0a] border border-[#262626] text-xs text-white cursor-pointer w-full sm:w-auto focus:border-white outline-none"
                      >
                        <option value={60} className="bg-[#0a0a0a]">1 час</option>
                        <option value={90} className="bg-[#0a0a0a]">1.5 часа</option>
                        <option value={120} className="bg-[#0a0a0a]">2 часа</option>
                        <option value={180} className="bg-[#0a0a0a]">3 часа</option>
                      </select>

                      {slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.id)}
                          className="p-1.5 text-[#71717a] hover:text-white rounded transition-colors sm:ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Message to Captain */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                  Личное сообщение капитану [{targetTeam.tag}]
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Например: привет, готовы сыграть спарринг перед турниром, связь через Discord/TS"
                  maxLength={500}
                  className="flex w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-xs text-white placeholder:text-[#52525b] focus-visible:outline-none focus-visible:border-white resize-none"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#222222]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetAndClose}
                  className="text-xs font-mono"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="cs"
                  size="sm"
                  disabled={loading}
                  className="gap-2 font-mono font-bold text-xs uppercase tracking-wider h-9"
                >
                  <Swords className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{loading ? 'Отправка...' : 'Отправить вызов капитану'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

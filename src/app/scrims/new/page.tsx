'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Crosshair,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Server,
  Ban,
  AlertCircle,
  CheckCircle2,
  Users,
  Globe,
  Check,
  Handshake,
} from 'lucide-react';
import { SERVER_LOCATIONS } from '@/lib/constants/servers';
import { FlagIcon } from '@/components/ui/flag-icon';

const PLATFORMS: Array<{ id: 'CYBERSHOCK' | 'XPLAY' | 'FASTCUP' | 'OTHER'; name: string }> = [
  { id: 'CYBERSHOCK', name: 'Cybershock' },
  { id: 'XPLAY', name: 'Xplay' },
  { id: 'FASTCUP', name: 'Fastcup' },
  { id: 'OTHER', name: 'Другой' },
];

const CS2_MAPS = [
  { id: 'de_mirage', name: 'Mirage' },
  { id: 'de_inferno', name: 'Inferno' },
  { id: 'de_nuke', name: 'Nuke' },
  { id: 'de_ancient', name: 'Ancient' },
  { id: 'de_anubis', name: 'Anubis' },
  { id: 'de_dust2', name: 'Dust II' },
  { id: 'de_overpass', name: 'Overpass' },
];

interface SlotItem {
  id: string;
  date: string;
  time: string;
  durationMin: number;
}

export default function CreateScrimPage() {
  const router = useRouter();
  const { user } = useUser();

  const [teamId, setTeamId] = useState(user?.teams[0]?.id || '');
  const [format, setFormat] = useState<'BO1' | 'BO2' | 'BO3'>('BO1');
  const [platform, setPlatform] = useState<'CYBERSHOCK' | 'XPLAY' | 'FASTCUP' | 'OTHER'>('CYBERSHOCK');
  const [level, setLevel] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [excludedMaps, setExcludedMaps] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);

  // Initialize with one default slot for today + 2 hours
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const nextHour = String((now.getHours() + 2) % 24).padStart(2, '0');
  const [slots, setSlots] = useState<SlotItem[]>([
    {
      id: '1',
      date: defaultDate,
      time: `${nextHour}:00`,
      durationMin: 120,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMapExcluded = (mapId: string) => {
    if (excludedMaps.includes(mapId)) {
      setExcludedMaps(excludedMaps.filter((m) => m !== mapId));
    } else {
      if (excludedMaps.length >= 4) {
        setError('Нельзя исключить более 4 карт');
        return;
      }
      setError(null);
      setExcludedMaps([...excludedMaps, mapId]);
    }
  };

  const toggleLocation = (city: string) => {
    if (selectedLocations.includes(city)) {
      setError(null);
      setSelectedLocations(selectedLocations.filter((c) => c !== city));
    } else {
      if (selectedLocations.length >= 4) {
        setError('Можно выбрать не более 4 серверов');
        return;
      }
      setError(null);
      setSelectedLocations([...selectedLocations, city]);
    }
  };

  const addSlot = () => {
    if (slots.length >= 10) return;
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

    const selectedTeam = teamId || user?.teams[0]?.id;
    if (!selectedTeam) {
      setError('Выберите команду');
      setLoading(false);
      return;
    }

    try {
      // Convert slots to ISO 8601 UTC strings
      const formattedSlots = slots.map((s) => {
        const localDate = new Date(`${s.date}T${s.time}:00`);
        if (isNaN(localDate.getTime())) {
          throw new Error('Некорректная дата или время слота');
        }
        if (localDate.getTime() <= Date.now()) {
          throw new Error(`Слот ${s.date} ${s.time} должен быть в будущем`);
        }
        return {
          startsAt: localDate.toISOString(),
          durationMin: Number(s.durationMin),
        };
      });

      if (selectedLocations.length > 4) {
        throw new Error('Можно выбрать не более 4 серверов');
      }

      const res = await fetch('/api/scrims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam,
          format,
          platform,
          level: level.trim() || null,
          serverBy: selectedLocations.length > 0 ? 'HOST' : 'NEGOTIABLE',
          serverLocations: selectedLocations,
          excludedMaps,
          comment: comment.trim() || null,
          slots: formattedSlots,
          expiresInDays,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при создании заявки');
      }

      router.push(`/scrims/${data.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла непредвиденная ошибка');
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container max-w-md py-16 text-center space-y-4">
        <p className="text-muted-foreground">Для создания заявки необходимо войти через Steam.</p>
        <Button variant="cs" onClick={() => router.push('/api/auth/steam')}>
          Войти через Steam
        </Button>
      </div>
    );
  }

  if (user.teams.length === 0) {
    return (
      <div className="container max-w-md py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-white/10 text-white border border-white/20 flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">Сначала создайте команду</h2>
        <p className="text-sm text-muted-foreground">
          Заявки на праки создаются от имени команды. Вы еще не являетесь владельцем или управляющим команды.
        </p>
        <Link href="/teams/new" className="inline-block pt-2">
          <Button variant="cs">Создать команду</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card className="border border-border bg-card shadow-xl shadow-black/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neutral-600 via-white to-neutral-600" />

        <CardHeader className="pb-4 pt-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white border border-white/20">
              <Crosshair className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-wider text-white">
                Создать заявку на прак
              </CardTitle>
              <CardDescription className="text-neutral-400 text-xs">
                Укажите формат, платформу, удобные временные слоты и пожелания по серверу.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team & Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Ваша команда *
                </label>
                <select
                  value={teamId || user.teams[0]?.id}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer font-bold"
                  required
                >
                  {user.teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-neutral-900">
                      {t.name} [{t.tag}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Формат встречи *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BO1', 'BO2', 'BO3'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`h-10 rounded-md text-sm font-mono font-bold uppercase transition-all ${
                        format === fmt
                          ? 'bg-white text-black shadow-md font-black'
                          : 'bg-cs-panel border border-border text-neutral-400 hover:text-white'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Platform Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-white" />
                  <span>Платформа проведения *</span>
                </label>
                <span className="text-[11px] text-neutral-500 font-mono">Где играется прак</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center border font-mono ${
                      platform === p.id
                        ? 'bg-white text-black border-white shadow-md font-black'
                        : 'bg-cs-panel border border-border text-neutral-400 hover:text-white hover:border-neutral-500'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Desired Level / Faceit ELO */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Желаемый уровень / Faceit ELO
              </label>
              <Input
                type="text"
                placeholder="например: Faceit 8-10, ESEA Adv, 2000+ elo"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                maxLength={50}
                className="bg-cs-panel border-border"
              />
            </div>

            {/* Server Location Selector */}
            <div className="space-y-3 p-4 rounded-xl border border-border bg-card shadow-xl shadow-black/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                      <Server className="w-3.5 h-3.5 text-white" />
                      <span>Выбор сервера *</span>
                    </label>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                        selectedLocations.length === 4
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : selectedLocations.length > 0
                          ? 'bg-white/10 text-white border-white/20'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {selectedLocations.length}/4
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Выберите до 4 локаций либо укажите «По договоренности»
                  </p>
                </div>

                {/* By Agreement Button */}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSelectedLocations([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 shrink-0 ${
                    selectedLocations.length === 0
                      ? 'bg-white text-black border-white shadow-md font-black'
                      : 'bg-cs-panel border-border text-neutral-300 hover:text-white hover:border-neutral-500'
                  }`}
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>По договоренности</span>
                </button>
              </div>

              {/* 2-Column Grid of Locations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {SERVER_LOCATIONS.map((loc) => {
                  const isChecked = selectedLocations.includes(loc.city);
                  const isMaxReached = selectedLocations.length >= 4 && !isChecked;

                  return (
                    <div
                      key={loc.id}
                      onClick={() => toggleLocation(loc.city)}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-all select-none ${
                        isChecked
                          ? 'border-white bg-cs-panel shadow-md ring-1 ring-white/20 cursor-pointer'
                          : isMaxReached
                          ? 'border-border/40 bg-cs-panel/40 opacity-40 cursor-not-allowed'
                          : 'border-border bg-cs-panel/60 hover:border-neutral-500 hover:bg-cs-panel cursor-pointer'
                      }`}
                    >
                      {/* Left: Flag + City name */}
                      <div className="flex items-center gap-2.5">
                        <FlagIcon country={loc.country} size={20} />
                        <span className={`text-sm ${isChecked ? 'text-white font-bold' : 'text-neutral-200 font-medium'}`}>
                          {loc.city}
                        </span>
                      </div>

                      {/* Right: Checkbox */}
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-white border-white text-black'
                            : isMaxReached
                            ? 'border-neutral-700 bg-neutral-900/40'
                            : 'border-neutral-600 bg-neutral-900/80'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
                <span>Статус выбора:</span>
                <span className="font-bold text-white">
                  {selectedLocations.length === 0
                    ? 'По договоренности'
                    : `${selectedLocations.join(', ')} (${selectedLocations.length}/4)`}
                </span>
              </div>
            </div>

            {/* Dynamic Time Slots Builder */}
            <div className="space-y-3 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-white" />
                  <span>Временные слоты (по вашему часовому поясу: {user.timezone})</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSlot}
                  disabled={slots.length >= 10}
                  className="gap-1 text-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить слот</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {slots.map((slot, index) => (
                  <div
                    key={slot.id}
                    className="flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-lg border border-neutral-800 bg-neutral-950"
                  >
                    <span className="text-xs font-mono font-bold text-white w-6 text-center">
                      #{index + 1}
                    </span>

                    <input
                      type="date"
                      value={slot.date}
                      min={defaultDate}
                      onChange={(e) => updateSlot(slot.id, 'date', e.target.value)}
                      className="h-9 px-3 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-white cursor-pointer w-full sm:w-auto"
                      required
                    />

                    <input
                      type="time"
                      value={slot.time}
                      onChange={(e) => updateSlot(slot.id, 'time', e.target.value)}
                      className="h-9 px-3 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-white cursor-pointer font-mono font-bold w-full sm:w-auto"
                      required
                    />

                    <select
                      value={slot.durationMin}
                      onChange={(e) => updateSlot(slot.id, 'durationMin', Number(e.target.value))}
                      className="h-9 px-3 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-white cursor-pointer w-full sm:w-auto"
                    >
                      <option value={60} className="bg-neutral-950">Длительность: 1 час</option>
                      <option value={90} className="bg-neutral-950">Длительность: 1.5 часа</option>
                      <option value={120} className="bg-neutral-950">Длительность: 2 часа</option>
                      <option value={180} className="bg-neutral-950">Длительность: 3 часа</option>
                    </select>

                    {slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(slot.id)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-md transition-colors sm:ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Excluded Maps */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Исключить нежелательные карты (максимум 4)</span>
                </span>
                <span className="font-mono text-[11px] text-neutral-500">
                  {excludedMaps.length}/4 исключено
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                {CS2_MAPS.map((map) => {
                  const isExcluded = excludedMaps.includes(map.id);
                  return (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => toggleMapExcluded(map.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                        isExcluded
                          ? 'bg-neutral-900 text-neutral-600 border border-neutral-800 line-through'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      {map.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Комментарий к заявке (необязательно)
              </label>
              <textarea
                rows={2}
                placeholder="Например: ищем сыгранный состав, разминка перед турниром, связь через TS/Discord"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                className="flex w-full rounded-md border border-input bg-cs-panel/60 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
              />
            </div>

            {/* Expiry Days */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-cs-panel/40 text-xs">
              <span className="text-muted-foreground">Срок жизни открытой заявки:</span>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="bg-transparent border-0 font-bold text-foreground cursor-pointer focus:outline-none"
              >
                <option value={1} className="bg-neutral-900">1 день</option>
                <option value={3} className="bg-neutral-900">3 дня</option>
                <option value={7} className="bg-neutral-900">7 дней (по умолчанию)</option>
                <option value={14} className="bg-neutral-900">14 дней</option>
              </select>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="cs"
              size="lg"
              disabled={loading}
              className="w-full gap-2 font-bold tracking-wider"
            >
              {loading ? (
                <span>Создание заявки...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>Опубликовать заявку в ленту</span>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Swords,
  ArrowRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { SERVER_LOCATIONS } from '@/lib/constants/servers';
import { FlagIcon } from '@/components/ui/flag-icon';
import { clearClientCache } from '@/lib/client-cache';

const PLATFORMS: Array<{ id: 'CYBERSHOCK' | 'XPLAY' | 'FASTCUP' | 'OTHER'; name: string }> = [
  { id: 'CYBERSHOCK', name: 'Cybershock' },
  { id: 'XPLAY', name: 'Xplay' },
  { id: 'FASTCUP', name: 'Fastcup' },
  { id: 'OTHER', name: 'Другой' },
];

const CS2_MAPS = [
  { id: 'de_dust2', name: 'Dust2', image: '/maps/de_dust2.webp' },
  { id: 'de_mirage', name: 'Mirage', image: '/maps/de_mirage.webp' },
  { id: 'de_nuke', name: 'Nuke', image: '/maps/de_nuke.webp' },
  { id: 'de_ancient', name: 'Ancient', image: '/maps/de_ancient.webp' },
  { id: 'de_inferno', name: 'Inferno', image: '/maps/de_inferno.webp' },
  { id: 'de_anubis', name: 'Anubis', image: '/maps/de_anubis.webp' },
  { id: 'de_cache', name: 'Cache', image: '/maps/de_cache.webp' },
  { id: 'de_vertigo', name: 'Vertigo', image: '/maps/de_vertigo.webp' },
];

interface SlotItem {
  id: string;
  date: string;
  time: string;
  durationMin: number;
}

function CreateScrimForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const opponentTag = searchParams.get('opponentTag');
  const opponentName = searchParams.get('opponentName');
  const { user } = useUser();

  const [teamId, setTeamId] = useState(user?.teams[0]?.id || '');
  const [format, setFormat] = useState<'BO1' | 'BO2' | 'BO3'>('BO1');
  const [platform, setPlatform] = useState<'CYBERSHOCK' | 'XPLAY' | 'FASTCUP' | 'OTHER'>('CYBERSHOCK');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [excludedMaps, setExcludedMaps] = useState<string[]>([]);
  const [comment, setComment] = useState(() => {
    if (opponentTag) return `Прямой вызов команде [${opponentTag}]`;
    return '';
  });
  const [expiresInDays, setExpiresInDays] = useState(7);

  // Initialize with one default slot for 2 hours in the future (local time)
  const targetDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const defaultDate = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const defaultHour = String(targetDate.getHours()).padStart(2, '0');

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const maxDay = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
  const maxDate = `${maxDay.getFullYear()}-${String(maxDay.getMonth() + 1).padStart(2, '0')}-${String(maxDay.getDate()).padStart(2, '0')}`;

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
  const [existingOpenScrimId, setExistingOpenScrimId] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  const serverDropdownRef = React.useRef<HTMLDivElement>(null);

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
    const selectedTeam = teamId || user?.teams[0]?.id;
    if (!selectedTeam) return;

    let cancelled = false;
    setCheckingExisting(true);
    fetch(`/api/scrims?teamId=${selectedTeam}&limit=1`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.data?.scrims?.length > 0) {
          setExistingOpenScrimId(data.data.scrims[0].id);
        } else if (!cancelled) {
          setExistingOpenScrimId(null);
        }
      })
      .catch(() => {
        if (!cancelled) setExistingOpenScrimId(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, user?.teams]);

  const toggleMapExcluded = (mapId: string) => {
    if (excludedMaps.includes(mapId)) {
      setExcludedMaps(excludedMaps.filter((m) => m !== mapId));
    } else {
      if (excludedMaps.length >= 3) {
        setError('Нельзя исключить более 3 карт');
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

    const selectedTeam = teamId || user?.teams[0]?.id;
    if (!selectedTeam) {
      setError('Выберите команду');
      setLoading(false);
      return;
    }

    if (existingOpenScrimId) {
      setError('У вашей команды уже есть открытая заявка на прак. Команда может иметь максимум 1 открытую заявку одновременно.');
      setLoading(false);
      return;
    }

    if (slots.length > 3) {
      setError('Максимум 3 предложения по времени');
      setLoading(false);
      return;
    }

    try {
      // Convert slots to ISO 8601 UTC strings
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
          level: null,
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

      clearClientCache();
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
      <Card className="border border-[#222222] bg-[#111111] shadow-2xl relative overflow-hidden">
        <CardHeader className="pb-4 pt-6 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0a0a0a] text-white border border-[#222222]">
              <Crosshair className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-white">
                Создать заявку на прак
              </CardTitle>
              <CardDescription className="text-[#a1a1aa] text-xs">
                Укажите формат, платформу, удобные временные слоты и пожелания по серверу.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {opponentTag && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-white/20 bg-[#161616] flex items-center gap-3">
            <Swords className="w-5 h-5 text-white shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">
                Прямой вызов команде: {opponentName || opponentTag} [{opponentTag}]
              </p>
              <p className="text-xs text-[#a1a1aa]">
                Настройте параметры матча и временные слоты для проведения прака.
              </p>
            </div>
          </div>
        )}

        {existingOpenScrimId && (
          <div className="mx-6 mt-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <p className="text-sm font-bold text-white">
                У вашей команды уже есть открытая заявка на прак
              </p>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Команда может иметь максимум 1 открытую заявку одновременно. Чтобы создать новую заявку, отмените существующую или дождитесь её завершения.
              </p>
              <div className="pt-1">
                <Link
                  href={`/scrims/${existingOpenScrimId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors"
                >
                  <span>Перейти к открытой заявке</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        <CardContent className="pt-6 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team & Format */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  Ваша команда *
                </label>
                <select
                  value={teamId || user.teams[0]?.id}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:border-white cursor-pointer font-bold transition-colors"
                  required
                >
                  {user.teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0a0a0a]">
                      {t.name} [{t.tag}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
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
                          ? 'bg-white text-black font-black'
                          : 'bg-[#0a0a0a] border border-[#222222] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
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
                <label className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-white" />
                  <span>Платформа проведения *</span>
                </label>
                <span className="text-[11px] text-[#52525b] font-mono">Где играется прак</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center border font-mono ${
                      platform === p.id
                        ? 'bg-white text-black border-white font-black'
                        : 'bg-[#0a0a0a] border border-[#222222] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Server Location Dropdown Selector */}
            <div className="space-y-2 p-4 rounded-lg border border-[#222222] bg-[#0a0a0a]" ref={serverDropdownRef}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                    <Server className="w-3.5 h-3.5 text-white" />
                    <span>Выбор сервера *</span>
                  </label>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                      selectedLocations.length === 4
                        ? 'bg-white text-black border-white'
                        : selectedLocations.length > 0
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-[#141414] text-[#71717a] border-[#222222]'
                    }`}
                  >
                    {selectedLocations.length === 0 ? 'По договоренности' : `${selectedLocations.length}/4`}
                  </span>
                </div>
                <span className="text-[11px] text-[#71717a] hidden sm:inline">
                  До 4 локаций или по договоренности
                </span>
              </div>

              {/* Trigger Input / Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsServerDropdownOpen((prev) => !prev)}
                  className={`w-full min-h-[46px] px-3.5 py-2 rounded-lg border transition-all flex items-center justify-between gap-2 text-left bg-[#111111] ${
                    isServerDropdownOpen
                      ? 'border-white ring-1 ring-white/20'
                      : 'border-[#222222] hover:border-[#383838]'
                  }`}
                >
                  {/* Selected items display */}
                  <div className="flex-1 min-w-0">
                    {selectedLocations.length === 0 ? (
                      <div className="flex items-center gap-2">
                        <Handshake className="w-4 h-4 text-[#71717a] shrink-0" />
                        <span className="text-sm font-semibold text-white">По договоренности</span>
                        <span className="text-xs text-[#71717a] hidden md:inline">
                          — любая удобная локация
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selectedLocations.map((city) => {
                          const loc = SERVER_LOCATIONS.find((l) => l.city === city);
                          return (
                            <span
                              key={city}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1a1a1a] border border-[#2e2e2e] text-xs font-semibold text-white group hover:border-[#555555] transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLocation(city);
                              }}
                            >
                              {loc && <FlagIcon country={loc.country} size={14} />}
                              <span>{city}</span>
                              <X className="w-3 h-3 text-[#71717a] group-hover:text-white transition-colors" />
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions & Chevron */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    {selectedLocations.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLocations([]);
                        }}
                        className="text-[11px] text-[#71717a] hover:text-white px-2 py-0.5 rounded hover:bg-[#1f1f1f] transition-colors"
                      >
                        Сбросить
                      </button>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-[#71717a] transition-transform duration-200 ${
                        isServerDropdownOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Pop-up Dropdown Menu */}
                {isServerDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-[#2a2a2a] bg-[#111111] shadow-2xl p-3 space-y-2.5 backdrop-blur-md">
                    {/* Top action row */}
                    <div className="flex items-center justify-between border-b border-[#222222] pb-2.5">
                      <div className="text-xs font-mono text-[#a1a1aa] flex items-center gap-2">
                        <span>Локации</span>
                        <span className="text-white font-bold">
                          ({selectedLocations.length}/4)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocations([]);
                          setError(null);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          selectedLocations.length === 0
                            ? 'bg-white text-black border-white'
                            : 'bg-[#181818] border-[#2a2a2a] text-[#a1a1aa] hover:text-white hover:border-[#444444]'
                        }`}
                      >
                        <Handshake className="w-3 h-3" />
                        <span>По договоренности</span>
                      </button>
                    </div>

                    {/* Scrollable grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                      {SERVER_LOCATIONS.map((loc) => {
                        const isChecked = selectedLocations.includes(loc.city);
                        const isMaxReached = selectedLocations.length >= 4 && !isChecked;

                        return (
                          <div
                            key={loc.id}
                            onClick={() => {
                              if (!isMaxReached) {
                                toggleLocation(loc.city);
                              }
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg border transition-all select-none ${
                              isChecked
                                ? 'border-white bg-[#1a1a1a] cursor-pointer'
                                : isMaxReached
                                ? 'border-[#1e1e1e] bg-[#0a0a0a]/50 opacity-35 cursor-not-allowed'
                                : 'border-[#222222] bg-[#141414] hover:border-[#383838] hover:bg-[#181818] cursor-pointer text-[#a1a1aa]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <FlagIcon country={loc.country} size={18} />
                              <span
                                className={`text-xs ${
                                  isChecked ? 'text-white font-bold' : 'text-[#d4d4d8]'
                                }`}
                              >
                                {loc.city}
                              </span>
                            </div>

                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                isChecked
                                  ? 'bg-white border-white text-black'
                                  : isMaxReached
                                  ? 'border-[#222222] bg-[#0a0a0a]'
                                  : 'border-[#333333] bg-[#0a0a0a]'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Dropdown Footer */}
                    <div className="flex items-center justify-between border-t border-[#222222] pt-2">
                      <span className="text-[11px] font-mono text-[#71717a]">
                        {selectedLocations.length === 0
                          ? 'Выбрано: По договоренности'
                          : `Выбрано: ${selectedLocations.join(', ')}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsServerDropdownOpen(false)}
                        className="px-3 py-1 rounded-md bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors"
                      >
                        Готово
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Time Slots Builder */}
            <div className="space-y-3 p-4 rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222222] pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-white" />
                      <span>Предложенное время</span>
                    </label>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                        slots.length >= 3
                          ? 'bg-white text-black border-white'
                          : 'bg-[#181818] text-[#a1a1aa] border-[#2e2e2e]'
                      }`}
                    >
                      {slots.length}/3 слота
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Укажите от 1 до 3 вариантов (макс. через 5 дней). По часовому поясу: {user.timezone}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSlot}
                  disabled={slots.length >= 3}
                  className="gap-1 text-xs shrink-0 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить время {slots.length >= 3 ? '(макс. 3)' : ''}</span>
                </Button>
              </div>

              <div className="space-y-2.5 pt-1">
                {slots.map((slot, index) => (
                  <div
                    key={slot.id}
                    className="flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-lg border border-[#2a2a2a] bg-[#141414]"
                  >
                    <span className="text-xs font-mono font-bold text-white w-6 text-center">
                      #{index + 1}
                    </span>

                    <input
                      type="date"
                      value={slot.date}
                      min={minDate}
                      max={maxDate}
                      onChange={(e) => updateSlot(slot.id, 'date', e.target.value)}
                      className="h-9 px-3 rounded-md bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-white cursor-pointer w-full sm:w-auto focus:border-white outline-none"
                      required
                    />

                    <input
                      type="time"
                      value={slot.time}
                      onChange={(e) => updateSlot(slot.id, 'time', e.target.value)}
                      className="h-9 px-3 rounded-md bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-white cursor-pointer font-mono font-bold w-full sm:w-auto focus:border-white outline-none"
                      required
                    />

                    <select
                      value={slot.durationMin}
                      onChange={(e) => updateSlot(slot.id, 'durationMin', Number(e.target.value))}
                      className="h-9 px-3 rounded-md bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-white cursor-pointer w-full sm:w-auto focus:border-white outline-none"
                    >
                      <option value={60} className="bg-[#0a0a0a]">Длительность: 1 час</option>
                      <option value={90} className="bg-[#0a0a0a]">Длительность: 1.5 часа</option>
                      <option value={120} className="bg-[#0a0a0a]">Длительность: 2 часа</option>
                      <option value={180} className="bg-[#0a0a0a]">Длительность: 3 часа</option>
                    </select>

                    {slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(slot.id)}
                        className="p-2 text-[#a1a1aa] hover:text-white hover:bg-[#1f1f1f] rounded-md transition-colors sm:ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Excluded Maps */}
            <div className="space-y-3 p-4 rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222222] pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5 font-mono">
                      <Ban className="w-3.5 h-3.5 text-white" />
                      <span>Исключить нежелательные карты</span>
                    </label>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                        excludedMaps.length > 0
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-[#181818] text-[#71717a] border-[#2e2e2e]'
                      }`}
                    >
                      {excludedMaps.length}/3 исключено
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Нажмите на карту, чтобы исключить её из прака (максимум 3)
                  </p>
                </div>

                {excludedMaps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExcludedMaps([])}
                    className="text-xs text-[#a1a1aa] hover:text-white px-2.5 py-1 rounded bg-[#161616] border border-[#2e2e2e] hover:border-[#444444] transition-all self-start sm:self-auto font-medium"
                  >
                    Сбросить выбор
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 pt-1">
                {CS2_MAPS.map((map) => {
                  const isExcluded = excludedMaps.includes(map.id);
                  return (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => toggleMapExcluded(map.id)}
                      className={`group relative flex flex-col items-center p-2 rounded-xl border transition-all duration-200 select-none ${
                        isExcluded
                          ? 'bg-red-950/25 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-red-500/30'
                          : 'bg-[#181818] border border-[#333333] hover:border-white hover:bg-[#202020] hover:scale-[1.02] shadow-sm'
                      }`}
                    >
                      {/* Map Thumbnail */}
                      <div
                        className={`relative w-full aspect-[3/2] overflow-hidden rounded-lg border transition-colors ${
                          isExcluded ? 'border-red-500/40' : 'border-white/10 group-hover:border-white/25'
                        }`}
                      >
                        <img
                          src={map.image}
                          alt={map.name}
                          className={`w-full h-full object-cover transition-all duration-200 ${
                            isExcluded
                              ? 'grayscale opacity-40 scale-95'
                              : 'group-hover:scale-105'
                          }`}
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
                          isExcluded
                            ? 'text-red-400 line-through'
                            : 'text-white group-hover:text-white'
                        }`}
                      >
                        {map.name}
                      </span>

                      {/* Status indicator badge */}
                      <span
                        className={`text-[10px] font-mono font-semibold transition-colors ${
                          isExcluded ? 'text-red-400 uppercase' : 'text-[#71717a] group-hover:text-[#d4d4d8]'
                        }`}
                      >
                        {isExcluded ? 'Исключена' : 'В пуле'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                Комментарий к заявке (необязательно)
              </label>
              <textarea
                rows={2}
                placeholder="Например: ищем сыгранный состав, разминка перед турниром, связь через TS/Discord"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                className="flex w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-sm text-white placeholder:text-[#52525b] focus-visible:outline-none focus-visible:border-white resize-none"
              />
            </div>

            {/* Automatic Expiry Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-lg border border-[#222222] bg-[#0a0a0a] text-xs font-mono">
              <span className="text-[#a1a1aa] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-white" />
                <span>Срок жизни заявки:</span>
              </span>
              <span className="text-white font-bold">
                до истечения последнего времени слота (автоматически)
              </span>
            </div>

            {/* Error Message directly above Submit */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3.5 text-red-300 text-sm animate-in fade-in zoom-in-95 duration-150">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="cs"
              size="lg"
              disabled={loading || Boolean(existingOpenScrimId) || checkingExisting}
              className="w-full gap-2 font-bold tracking-wider"
            >
              {loading ? (
                <span>Создание заявки...</span>
              ) : existingOpenScrimId ? (
                <span>У команды уже есть открытая заявка (макс. 1)</span>
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

export default function CreateScrimPage() {
  return (
    <Suspense fallback={<div className="container py-12 text-center text-[#a1a1aa] font-mono">Загрузка формы...</div>}>
      <CreateScrimForm />
    </Suspense>
  );
}

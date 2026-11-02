'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Power,
  Calendar,
  Users,
  Clock,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

interface CodeActivationItem {
  id: string;
  userId: string;
  activatedAt: string;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string;
    steamId: string;
  };
}

interface ActivationCodeItem {
  id: string;
  code: string;
  description: string | null;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  activations: CodeActivationItem[];
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<ActivationCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);

  // Form State
  const [customCode, setCustomCode] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/codes');
      const data = await res.json();
      if (data.success) {
        setCodes(data.data);
      } else {
        setError(data.error || 'Ошибка загрузки кодов');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Сетевая ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const handleGenerateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randPart = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setCustomCode(`PRO-${randPart(4)}-${randPart(4)}`);
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: customCode.trim() || undefined,
          durationDays: Number(durationDays),
          maxUses: Number(maxUses),
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
          description: description.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при создании кода');
      }

      setSuccess(`Код ${data.data.code} успешно создан!`);
      setCustomCode('');
      setDescription('');
      await loadCodes();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось создать код');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch(`/api/admin/codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentState }),
      });
      if (res.ok) {
        setCodes(codes.map((c) => (c.id === id ? { ...c, isActive: !currentState } : c)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCode = async (id: string, codeString: string) => {
    if (!confirm(`Вы действительно хотите удалить код ${codeString}?`)) return;
    try {
      const res = await fetch(`/api/admin/codes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCodes(codes.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(codeText);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCodes = codes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="container py-8 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[#222222] bg-[#111111] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black flex items-center justify-center font-bold shadow-md shrink-0">
            <Key className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-black text-lg uppercase tracking-wider text-white font-mono flex items-center gap-2">
              <span>Коды активации PRO</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {codes.length} шт.
              </span>
            </h1>
            <span className="text-xs text-[#a1a1aa] block font-mono">
              Генерация и управление промокодами для выдачи подписки PRO
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCodes}
            disabled={loading}
            className="h-9 gap-1.5 text-xs font-mono font-bold border-[#2c2c2c] bg-[#161616] hover:bg-[#222] text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </Button>

          <Link href="/admin">
            <Button variant="outline" size="sm" className="h-9 text-xs font-mono border-neutral-700 text-neutral-400 hover:text-white">
              ← Назад в панель
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-mono">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Generator Form */}
      <Card className="border border-amber-500/30 bg-gradient-to-b from-[#161309] to-[#0f0e0b] shadow-xl">
        <CardHeader className="pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-base font-bold text-white font-mono uppercase tracking-wider">
              Генератор нового кода активации
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-neutral-400">
            Задайте параметры подписки, количество активаций и срок жизни промокода.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleCreateCode} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Code Name / Input */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-xs font-mono font-bold text-neutral-300 flex items-center justify-between">
                  <span>Код (или оставьте пустым для авто):</span>
                  <button
                    type="button"
                    onClick={handleGenerateRandomCode}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Сгенерировать случайный
                  </button>
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="например: PRO-7X9B-2026"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    className="bg-[#0b0a0a] border-neutral-800 font-mono font-bold text-sm tracking-wider uppercase text-amber-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateRandomCode}
                    className="shrink-0 text-xs font-mono border-neutral-700 hover:border-amber-500/50"
                  >
                    🎲 Случайный
                  </Button>
                </div>
              </div>

              {/* PRO Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Срок PRO (дней):</span>
                </label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md bg-[#0b0a0a] border border-neutral-800 text-xs font-mono font-bold text-white focus:border-white outline-none cursor-pointer"
                >
                  <option value={7}>7 дней (1 неделя)</option>
                  <option value={14}>14 дней (2 недели)</option>
                  <option value={30}>30 дней (1 месяц)</option>
                  <option value={90}>90 дней (3 месяца)</option>
                  <option value={180}>180 дней (полгода)</option>
                  <option value={365}>365 дней (1 год)</option>
                </select>
              </div>

              {/* Max Activations (Uses) */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-amber-400" />
                  <span>Кол-во активаций:</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))}
                  className="bg-[#0b0a0a] border-neutral-800 font-mono font-bold text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Code Expiration */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>Срок действия самого кода:</span>
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 px-3 rounded-md bg-[#0b0a0a] border border-neutral-800 text-xs font-mono font-bold text-white focus:border-white outline-none cursor-pointer"
                >
                  <option value="">Бессрочный (без срока)</option>
                  <option value={7}>Истекает через 7 дней</option>
                  <option value={14}>Истекает через 14 дней</option>
                  <option value={30}>Истекает через 30 дней</option>
                  <option value={90}>Истекает через 90 дней</option>
                </select>
              </div>

              {/* Description / Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-neutral-300">
                  Примечание / Источник (опционально):
                </label>
                <Input
                  type="text"
                  placeholder="например: Продажа на сайте #8849 или Розыгрыш в VK"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-[#0b0a0a] border-neutral-800 font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                disabled={creating}
                className="gap-2 font-black font-mono uppercase text-xs tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300 shadow-md h-10 px-6"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                <span>Создать код активации</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Codes Table List */}
      <Card className="border border-[#222222] bg-[#111111] shadow-xl">
        <CardHeader className="pb-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-white font-mono uppercase tracking-wider">
              Все сгенерированные коды ({filteredCodes.length})
            </CardTitle>
            <CardDescription className="text-xs text-neutral-400">
              Список выданных кодов, статус использования и история активаций.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Поиск по коду..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-[#0c0c0c] border-neutral-800 font-mono"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-neutral-400 font-mono text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Загрузка кодов...</span>
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-neutral-500 space-y-1">
              <p>Коды не найдены</p>
              <p className="text-[11px] text-neutral-600">Создайте первый код в форме выше.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e1e1e]">
              {filteredCodes.map((item) => {
                const isFullyUsed = item.usedCount >= item.maxUses;
                const isExpired = item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();
                const isExpanded = expandedCodeId === item.id;

                return (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-[#141414] transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Code + Copy */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-[#0c0c0c] border border-amber-500/30 px-3 py-1.5 rounded-lg">
                          <Key className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="font-mono font-black text-sm text-white tracking-widest select-all">
                            {item.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.code)}
                            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors ml-1"
                            title="Скопировать код"
                          >
                            {copiedCode === item.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5">
                          {!item.isActive ? (
                            <Badge variant="outline" className="border-red-500/40 text-red-400 text-[10px]">
                              Отключен
                            </Badge>
                          ) : isExpired ? (
                            <Badge variant="outline" className="border-neutral-600 text-neutral-400 text-[10px]">
                              Истек
                            </Badge>
                          ) : isFullyUsed ? (
                            <Badge variant="outline" className="border-neutral-600 text-neutral-400 text-[10px]">
                              Использован
                            </Badge>
                          ) : (
                            <Badge variant="cs" className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                              Активен
                            </Badge>
                          )}

                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {item.durationDays} дн. PRO
                          </span>
                        </div>
                      </div>

                      {/* Stats & Metadata */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-400">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-neutral-500" />
                          <span>
                            Активаций:{' '}
                            <strong className="text-white font-black">
                              {item.usedCount} / {item.maxUses}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                          <span>
                            {item.expiresAt
                              ? `Истекает: ${new Date(item.expiresAt).toLocaleDateString('ru-RU')}`
                              : 'Бессрочный'}
                          </span>
                        </div>

                        {item.description && (
                          <span className="text-neutral-500 italic truncate max-w-xs" title={item.description}>
                            "{item.description}"
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {item.activations.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedCodeId(isExpanded ? null : item.id)}
                              className="h-8 text-xs font-mono gap-1 text-neutral-300 hover:text-white"
                            >
                              <span>{item.activations.length} акт.</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(item.id, item.isActive)}
                            className={`h-8 text-xs font-mono ${
                              item.isActive
                                ? 'text-neutral-400 hover:text-amber-400 hover:border-amber-500/40'
                                : 'text-emerald-400 hover:text-emerald-300 border-emerald-500/30'
                            }`}
                            title={item.isActive ? 'Деактивировать' : 'Включить код'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCode(item.id, item.code)}
                            className="h-8 text-xs font-mono text-neutral-500 hover:text-rose-400 hover:border-rose-500/40"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded activations list */}
                    {isExpanded && item.activations.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-black/50 border border-white/5 space-y-2">
                        <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 tracking-wider block">
                          История активаций кода:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.activations.map((act) => (
                            <div
                              key={act.id}
                              className="flex items-center gap-2 p-2 rounded-lg bg-[#141414] border border-white/5 text-xs font-mono"
                            >
                              <Avatar
                                src={act.user.avatarUrl}
                                alt={act.user.nickname}
                                fallback={act.user.nickname}
                                size="sm"
                              />
                              <div className="truncate flex-1">
                                <span className="font-bold text-white block truncate">
                                  {act.user.nickname}
                                </span>
                                <span className="text-[10px] text-neutral-500">
                                  {new Date(act.activatedAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

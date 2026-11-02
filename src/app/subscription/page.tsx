'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Server,
  Ban,
  Bell,
  Swords,
  Loader2,
  ChevronRight,
  Key,
  Calendar,
  AlertCircle,
  Gift,
} from 'lucide-react';

export default function SubscriptionPage() {
  const { user, refreshUser } = useUser();
  const [promoCode, setPromoCode] = useState('');
  const [activatingCode, setActivatingCode] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const isPro = Boolean(
    user?.isPro && (!user?.proExpiresAt || new Date(user.proExpiresAt).getTime() > Date.now())
  );

  const formattedExpiry = user?.proExpiresAt
    ? new Date(user.proExpiresAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const handleActivateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    setActivatingCode(true);
    setCodeSuccess(null);
    setCodeError(null);

    try {
      const res = await fetch('/api/subscription/activate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось активировать код');
      }

      setCodeSuccess(data.message);
      setPromoCode('');
      await refreshUser();
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : 'Ошибка при активации');
    } finally {
      setActivatingCode(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-xs uppercase tracking-wider px-3 py-1"
        >
          ⭐ Тарифные планы Ascent Pracc
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-black uppercase font-mono tracking-wider text-white">
          Выберите подходящий тариф
        </h1>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto">
          Тренируйтесь с равными соперниками. Подписка <strong className="text-amber-400">PRO</strong> дает приоритет откликов и заявок вверху списка, гибкий выбор серверов и слотов, бан карт и мгновенные уведомления в Discord.
        </p>

        {/* PRO Status Badge */}
        {user && isPro && (
          <div className="pt-2 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/40 text-xs font-mono shadow-lg shadow-amber-950/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-neutral-300">
                Статус: <strong className="text-amber-400">PRO</strong>
              </span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-400">
                {formattedExpiry ? (
                  <>Действует до: <strong className="text-white">{formattedExpiry}</strong></>
                ) : (
                  <strong className="text-white">Бессрочно</strong>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Plans Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* FREE PLAN */}
        <Card className={`border flex flex-col justify-between ${
          !isPro
            ? 'border-neutral-500 bg-[#141414] shadow-lg'
            : 'border-neutral-800 bg-[#0f0f0f] opacity-80'
        }`}>
          <div>
            <CardHeader className="p-6 border-b border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-neutral-400 uppercase tracking-wider">
                  План FREE
                </span>
                {!isPro && (
                  <Badge variant="outline" className="border-neutral-600 text-neutral-300 text-[10px]">
                    Текущий тариф
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                  Бесплатно
                </span>
                <span className="text-xs text-neutral-500 font-mono">/ навсегда</span>
              </div>
              <CardDescription className="text-xs text-neutral-400">
                Базовый доступ к платформе, созданию команд и участию в праках со стандартным вето.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <span className="text-[11px] font-mono uppercase font-bold text-neutral-500 tracking-wider">
                Возможности тарифа:
              </span>
              <ul className="space-y-3 text-xs">
                <li className="flex items-start gap-2.5 text-neutral-300">
                  <Check className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Полный доступ к пракам и матчам</span>
                </li>
                <li className="flex items-start gap-2.5 text-neutral-300">
                  <Check className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>До <strong>2 слотов со временем</strong> при создании</span>
                </li>
                <li className="flex items-start gap-2.5 text-neutral-300">
                  <Check className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <span>Выбор серверов: <strong>ровно 4 локации</strong></span>
                </li>
                <li className="flex items-start gap-2.5 text-neutral-400">
                  <X className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                  <span>Бан карт при создании (все 7 карт в пуле вето)</span>
                </li>
                <li className="flex items-start gap-2.5 text-neutral-400">
                  <X className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                  <span>Приоритетное размещение праков вверху ленты</span>
                </li>
                <li className="flex items-start gap-2.5 text-neutral-400">
                  <X className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                  <span>Приоритет откликов (заявки в общем порядке очереди)</span>
                </li>
                <li className="flex items-start gap-2.5 text-neutral-400">
                  <X className="w-4 h-4 text-neutral-600 shrink-0 mt-0.5" />
                  <span>Оповещения через Discord Webhook в канал команды</span>
                </li>
              </ul>
            </CardContent>
          </div>

          <div className="p-6 pt-0">
            {isPro ? (
              <div className="space-y-2">
                <Button
                  disabled
                  variant="outline"
                  className="w-full text-xs font-bold border-neutral-800 text-neutral-500 cursor-not-allowed"
                >
                  Недоступно (активен PRO)
                </Button>
                <p className="text-[11px] text-neutral-500 font-mono text-center leading-tight">
                  Тариф PRO активен {formattedExpiry ? `до ${formattedExpiry}` : 'бессрочно'}. Досрочная отмена подписки не предусмотрена.
                </p>
              </div>
            ) : (
              <Button disabled variant="outline" className="w-full text-xs font-bold border-neutral-800 text-neutral-500">
                Текущий тариф
              </Button>
            )}
          </div>
        </Card>

        {/* PRO PLAN */}
        <Card className={`border flex flex-col justify-between relative overflow-hidden ${
          isPro
            ? 'border-amber-500 bg-gradient-to-b from-[#1c1608] via-[#12100a] to-[#0c0c0c] shadow-2xl shadow-amber-950/40 ring-1 ring-amber-500/30'
            : 'border-amber-500/40 bg-gradient-to-b from-[#181307] to-[#0f0e0c] shadow-xl'
        }`}>
          <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 h-1" />

          <div>
            <CardHeader className="p-6 border-b border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>План PRO</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black font-mono text-[10px] uppercase tracking-wider shadow">
                  {isPro ? 'АКТИВЕН' : 'РЕКОМЕНДУЕМ'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                  По коду активации
                </span>
              </div>
              <CardDescription className="text-xs text-neutral-300">
                Код можно получить при покупке на основном сайте или промоакции.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <span className="text-[11px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                Всё из Free, а также:
              </span>
              <ul className="space-y-3 text-xs">
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">Бан 2 карт при создании</strong>: вычеркивайте ненужные карты заранее
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">Праки вверху ленты</strong>: ваши карточки прака закрепляются в самом топе
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">Приоритет откликов</strong>: при отклике на прак ваша заявка будет выше остальных
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">До 3 слотов со временем</strong>: больше гибкости при поиске соперника
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">Выбор от 1 до 4 серверов</strong>: можно указать ровно 1 локацию с мин. пингом
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">Discord Webhook</strong>: мгновенные оповещения об откликах прямо в ваш сервер
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-white">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <span>
                    <strong className="text-amber-400">Внешний вид PRO</strong>: золотой бейдж в профиле, лобби и карточке прака
                  </span>
                </li>
              </ul>
            </CardContent>
          </div>

          <div className="p-6 pt-0">
            {isPro ? (
              <Button
                variant="outline"
                className="w-full text-xs font-bold border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                onClick={() => {
                  document.getElementById('code-activation-section')?.scrollIntoView({ behavior: 'smooth' });
                  document.getElementById('code-input')?.focus();
                }}
              >
                Продлить подписку по коду
              </Button>
            ) : (
              <Button
                className="w-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300 h-10 shadow-lg shadow-amber-950/40"
                onClick={() => {
                  document.getElementById('code-activation-section')?.scrollIntoView({ behavior: 'smooth' });
                  document.getElementById('code-input')?.focus();
                }}
              >
                Ввести код активации
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Promo Code Activation Section */}
      <Card id="code-activation-section" className="border border-[#2a2415] bg-gradient-to-b from-[#161208] via-[#100e08] to-[#0a0a0a] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-black flex items-center justify-center font-bold shadow-lg shadow-amber-950/50 shrink-0">
                <Key className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black uppercase font-mono tracking-wider text-white flex items-center gap-2">
                  <span>Активация по коду или промокоду</span>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px] font-mono">
                    PRO КЛЮЧ
                  </Badge>
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Купили ключ на основном сайте или получили промокод? Активируйте его здесь для мгновенного продления статуса PRO.
                </p>
              </div>
            </div>

            {user?.role === 'ADMIN' && (
              <Link
                href="/admin/codes"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-mono font-bold hover:bg-amber-500/20 transition-colors shrink-0"
              >
                <span>Админка кодов</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleActivateCode} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Key className="w-4 h-4" />
                </div>
                <Input
                  id="code-input"
                  type="text"
                  placeholder="Введите код (например: PRO-XXXX-XXXX)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={activatingCode}
                  className="pl-10 h-11 bg-black/60 border-neutral-700 focus:border-amber-500 text-sm font-mono tracking-widest text-white uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-500"
                />
              </div>
              <Button
                type="submit"
                disabled={activatingCode || !promoCode.trim()}
                className="h-11 px-6 font-mono font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300 shadow-md shadow-amber-950/40 shrink-0 gap-2"
              >
                {activatingCode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Проверка...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 stroke-[2.5]" />
                    <span>Активировать код</span>
                  </>
                )}
              </Button>
            </div>

            {codeSuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-xs font-mono flex items-start gap-2.5 animate-in fade-in duration-200">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400 stroke-[2.5]" />
                <span className="leading-relaxed font-semibold">{codeSuccess}</span>
              </div>
            )}

            {codeError && (
              <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs font-mono flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{codeError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-500 pt-1">
              <span>• Срок действия подписки суммируется, если у вас уже есть PRO</span>
              <span>• Каждый код можно активировать один раз на аккаунт</span>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Quick links footer */}
      <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400 font-mono">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Безопасная активация • Мгновенное применение прав</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/scrims/new" className="text-white hover:text-amber-400 transition-colors flex items-center gap-1">
            <span>Создать прак</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
          <Link href="/settings#discord-webhook" className="text-white hover:text-amber-400 transition-colors flex items-center gap-1">
            <span>Настроить Webhook</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
          <Link href="/settings" className="text-white hover:text-amber-400 transition-colors flex items-center gap-1">
            <span>Настройки аккаунта</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

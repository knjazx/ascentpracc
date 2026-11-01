'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MessageSquare,
  Check,
  AlertCircle,
  Save,
  ExternalLink,
  Send,
  Loader2,
  Bot,
  HelpCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshUser } = useUser();
  const [timezone, setTimezone] = useState('');
  const [detectedTz, setDetectedTz] = useState('');
  const [discordTag, setDiscordTag] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Testing Discord DM
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [testDiscordResult, setTestDiscordResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setDetectedTz(detected);
    } catch {
      setDetectedTz('Europe/Moscow');
    }
  }, []);

  useEffect(() => {
    if (user) {
      setTimezone(user.timezone || 'SYSTEM');
      setDiscordTag(user.discordTag || '');
      setDiscordId(user.discordId || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    setTestDiscordResult(null);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: detectedTz || 'SYSTEM',
          discordTag: discordTag.trim() || null,
          discordId: discordId.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при сохранении настроек');
      }

      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки');
    } finally {
      setLoading(false);
    }
  };

  const handleTestDiscordDM = async () => {
    setTestingDiscord(true);
    setTestDiscordResult(null);
    setError(null);

    try {
      // First save if inputs changed
      if (discordTag.trim() !== (user?.discordTag || '') || discordId.trim() !== (user?.discordId || '')) {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timezone: detectedTz || 'SYSTEM',
            discordTag: discordTag.trim() || null,
            discordId: discordId.trim() || null,
          }),
        });
        await refreshUser();
      }

      const res = await fetch('/api/me/discord-test', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось отправить тестовое сообщение');
      }

      setTestDiscordResult({
        success: true,
        message: data.message || 'Тестовое сообщение успешно отправлено в ваш Discord!',
      });
      await refreshUser();
    } catch (err: unknown) {
      setTestDiscordResult({
        success: false,
        message: err instanceof Error ? err.message : 'Ошибка при отправке сообщения в Discord',
      });
    } finally {
      setTestingDiscord(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Загрузка данных пользователя...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-wider text-foreground">
          Настройки профиля
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Управление персональными данными, часовым поясом и уведомлениями бота ASCENT HELPER.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Steam Account Info Card */}
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Steam Аккаунт</CardTitle>
            <CardDescription>
              Основные данные синхронизируются напрямую с вашим Steam-профилем.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar src={user.avatarUrl} alt={user.nickname} fallback={user.nickname} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-lg">{user.nickname}</span>
                  {user.role === 'ADMIN' && <Badge variant="admin">ADMIN</Badge>}
                </div>
              </div>
            </div>

            <a
              href={`https://steamcommunity.com/profiles/${user.steamId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-2 text-xs border-neutral-700 hover:bg-neutral-800 text-white">
                <span>Профиль Steam</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Preferences Form */}
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Параметры и уведомления в Discord</CardTitle>
            <CardDescription>
              Настройте часовой пояс и подключите бота ASCENT HELPER для моментальных оповещений об откликах.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {saved && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-white/20 bg-white/5 p-3.5 text-white text-sm">
                <Check className="w-5 h-5 shrink-0 mt-0.5 text-white" />
                <span>Настройки успешно сохранены!</span>
              </div>
            )}

            {testDiscordResult && (
              <div
                className={`mb-6 flex items-start gap-3 rounded-lg border p-3.5 text-sm ${
                  testDiscordResult.success
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {testDiscordResult.success ? (
                  <Check className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="space-y-1">
                  <span className="font-semibold block">
                    {testDiscordResult.success ? 'Уведомление отправлено!' : 'Ошибка доставки в Discord:'}
                  </span>
                  <span className="text-xs leading-relaxed block">{testDiscordResult.message}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* Timezone display (Auto-detected from OS) */}
              <div className="p-3.5 rounded-lg border border-border bg-cs-panel space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white" />
                    <span>Часовой пояс</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>Автоматически по системе</span>
                  </span>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-sm font-bold font-mono text-foreground">
                    {detectedTz || 'Europe/Moscow'}
                  </span>
                  <Check className="w-4 h-4 text-white" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Время всех матчей и праков переводится автоматически по часам вашего компьютера.
                </p>
              </div>

              {/* Discord Integration Box (ASCENT HELPER) */}
              <div className="p-4 rounded-xl border border-purple-500/30 bg-[#120f18] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Уведомления от бота ASCENT HELPER
                      </span>
                      <span className="text-[11px] text-[#a1a1aa] block">
                        Бот отправляет вам сообщение в ЛС, когда кто-то откликается на ваш прак
                      </span>
                    </div>
                  </div>

                  <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Встроено в сайт
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-mono">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      <span>Discord юзернейм / тег</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="например: yurka0344 или captain#1337"
                      value={discordTag}
                      onChange={(e) => setDiscordTag(e.target.value)}
                      maxLength={32}
                      className="bg-[#0b0a0e] border-neutral-800 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Имя пользователя на сервере Ascent League.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-mono">
                      <span>Discord User ID (числовой)</span>
                      <span title="ПКМ по своему профилю в Discord -> Скопировать ID пользователя">
                        <HelpCircle className="w-3 h-3 text-[#71717a] cursor-help" />
                      </span>
                    </label>
                    <Input
                      type="text"
                      placeholder="например: 674675822476656660"
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value)}
                      maxLength={20}
                      className="bg-[#0b0a0e] border-neutral-800 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Опционально. Если указан, бот находит вас мгновенно.
                    </p>
                  </div>
                </div>

                {/* Verification & Test button */}
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/40 p-3 rounded-lg border border-purple-500/20">
                  <div className="text-[11px] text-[#a1a1aa] leading-tight">
                    💡 Чтобы бот мог написать в ЛС, вы должны состоять на сервере{' '}
                    <span className="text-purple-300 font-bold">Ascent League ・ Сs2</span> и иметь открытые ЛС.
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testingDiscord || (!discordTag && !discordId)}
                    onClick={handleTestDiscordDM}
                    className="shrink-0 h-8 text-xs font-bold gap-1.5 border-purple-500/40 text-purple-200 hover:bg-purple-500/20 hover:text-white"
                  >
                    {testingDiscord ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{testingDiscord ? 'Проверка...' : 'Проверить ЛС'}</span>
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="cs"
                  disabled={loading}
                  className="gap-2 font-bold"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Сохранение...' : 'Сохранить изменения'}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

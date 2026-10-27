'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, Check, AlertCircle, Save, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshUser } = useUser();
  const [timezone, setTimezone] = useState('');
  const [detectedTz, setDetectedTz] = useState('');
  const [discordTag, setDiscordTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: detectedTz || 'SYSTEM',
          discordTag: discordTag.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при сохранении настроек');
      }

      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки');
    } finally {
      setLoading(false);
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
          Управление персональными данными, часовым поясом и контактами для связи.
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
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  SteamID: {user.steamId}
                </p>
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
            <CardTitle className="text-lg">Параметры и контакты</CardTitle>
            <CardDescription>
              Настройте часовой пояс для верного отображения времени всех праков.
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

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                  <span>Discord тег</span>
                </label>
                <Input
                  type="text"
                  placeholder="например: captain_cs2 или captain#1337"
                  value={discordTag}
                  onChange={(e) => setDiscordTag(e.target.value)}
                  maxLength={32}
                  className="bg-neutral-950 border-neutral-800"
                />
                <p className="text-[11px] text-muted-foreground">
                  Отображается капитанам соперников в лобби матча.
                </p>
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

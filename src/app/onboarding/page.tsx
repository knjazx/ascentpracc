'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MessageSquare, CheckCircle2, AlertCircle, Sparkles, Check } from 'lucide-react';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const { user, refreshUser } = useUser();

  const [detectedTz, setDetectedTz] = useState<string>('');
  const [discordTag, setDiscordTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect browser/OS timezone on mount
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setDetectedTz(tz);
      else setDetectedTz('Europe/Moscow');
    } catch {
      setDetectedTz('Europe/Moscow');
    }

    if (user?.discordTag) {
      setDiscordTag(user.discordTag);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
        throw new Error(data.error || 'Не удалось завершить настройку');
      }

      await refreshUser();
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при сохранении');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg border border-border bg-card shadow-2xl shadow-black/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-700 via-white to-neutral-700" />

        <CardHeader className="text-center pb-4 pt-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white border border-white/20 mb-3 shadow-lg shadow-white/5">
            <Sparkles className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-wider text-foreground">
            Добро пожаловать в лигу!
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm max-w-sm mx-auto">
            Остался один быстрый шаг перед началом: мы автоматически настроили ваш часовой пояс по системе.
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Automatic Timezone Display */}
            <div className="p-4 rounded-lg border border-border bg-cs-panel space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white" />
                  <span>Часовой пояс</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>Определен автоматически</span>
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-base font-bold font-mono text-foreground">
                  {detectedTz || 'Определение часового пояса...'}
                </span>
                <Check className="w-4 h-4 text-white" />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Время всех слотов и матчей будет автоматически отображаться по часам вашего компьютера.
              </p>
            </div>

            {/* Discord Tag (Optional) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span>Discord тег (необязательно)</span>
              </label>
              <Input
                type="text"
                placeholder="например: captain_cs2 или captain#1337"
                value={discordTag}
                onChange={(e) => setDiscordTag(e.target.value)}
                maxLength={32}
                className="text-sm h-10 bg-neutral-950 border-neutral-800"
              />
              <p className="text-[11px] text-muted-foreground">
                Поможет капитанам соперников быстрее связываться с вами перед матчем.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full h-11 text-sm font-bold uppercase tracking-wider bg-white hover:bg-neutral-200 text-black shadow-lg"
            >
              {loading ? 'Сохранение...' : 'Завершить и войти в лигу'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">Загрузка...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
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
      <Card className="w-full max-w-lg border border-[#222222] bg-[#111111] shadow-2xl relative overflow-hidden rounded-xl">
        <CardHeader className="text-center pb-4 pt-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center mb-3 select-none relative">
            <Image
              src="/images/ascent-icon.png"
              alt="Ascent Pracc"
              width={64}
              height={64}
              className="w-full h-full object-contain relative"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-wider text-white font-mono">
            Добро пожаловать в Ascent Pracc!
          </CardTitle>
          <CardDescription className="text-[#a1a1aa] text-sm max-w-sm mx-auto">
            Остался один быстрый шаг перед началом: мы автоматически настроили ваш часовой пояс по системе.
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Automatic Timezone Display */}
            <div className="p-4 rounded-xl border border-[#222222] bg-[#0a0a0a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white" />
                  <span>Часовой пояс</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/30 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  <span>Определен автоматически</span>
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-base font-bold font-mono text-white">
                  {detectedTz || 'Определение часового пояса...'}
                </span>
                <Check className="w-4 h-4 text-[#10b981]" />
              </div>

              <p className="text-[11px] text-[#52525b] leading-relaxed">
                Время всех слотов и матчей будет автоматически отображаться по часам вашего компьютера.
              </p>
            </div>

            {/* Discord Tag (Optional) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span>Discord тег (необязательно)</span>
              </label>
              <Input
                type="text"
                placeholder="например: captain_cs2 или captain#1337"
                value={discordTag}
                onChange={(e) => setDiscordTag(e.target.value)}
                maxLength={32}
                className="text-sm h-10 bg-[#0a0a0a] border border-[#222222] text-white placeholder:text-[#52525b] focus-visible:border-white"
              />
              <p className="text-[11px] text-[#52525b]">
                Поможет капитанам соперников быстрее связываться с вами перед матчем.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="cs"
              disabled={loading}
              className="w-full h-11 text-sm font-bold uppercase tracking-wider"
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

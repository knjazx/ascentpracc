'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Crosshair, ShieldCheck, Zap, Swords } from 'lucide-react';
import { SteamIcon } from '@/components/icons/SteamIcon';

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'Слишком много попыток входа. Пожалуйста, подождите минуту перед следующей попыткой.',
  cancelled: 'Авторизация через Steam была отменена пользователем.',
  invalid_nonce: 'Срок действия сессии входа истек или токен безопасности недействителен. Попробуйте снова.',
  invalid_return_to: 'Недопустимый URL возврата после авторизации.',
  signature_failed: 'Не удалось подтвердить цифровую подпись Steam OpenID. Попробуйте еще раз.',
  steam_unavailable: 'Серверы авторизации Valve Steam временно недоступны. Повторите попытку позже.',
  invalid_steam_id: 'Не удалось извлечь корректный 64-битный Steam ID.',
  missing_api_key: 'В конфигурации платформы не настроен STEAM_API_KEY. Обратитесь к администратору.',
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get('error');
  const next = searchParams.get('next') || '/';

  const errorMessage = errorKey
    ? ERROR_MESSAGES[errorKey] || 'Произошла непредвиденная ошибка при авторизации.'
    : null;

  const steamLoginUrl = `/api/auth/steam?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">Ошибка авторизации</p>
              <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        <Card className="border border-border bg-card shadow-2xl shadow-black/50 relative overflow-hidden">
          {/* Decorative ambient top line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-700 via-white to-neutral-700" />

          <CardHeader className="text-center pb-4 pt-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black border border-border shadow-lg shadow-black/50 mb-3 overflow-hidden p-0.5">
              <Image
                src="/images/ascent-logo.png"
                alt="Ascent Pracc Logo"
                width={64}
                height={64}
                className="w-full h-full object-cover rounded-full"
                priority
              />
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-wider text-foreground font-mono">
              Вход в <span className="text-white">Ascent Pracc</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm max-w-xs mx-auto">
              Авторизуйтесь через официальный Steam для управления командами, поиска скримов и участия в вето матчей.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <div className="space-y-3">
              <a href={steamLoginUrl} className="block w-full">
                <Button
                  variant="steam"
                  size="lg"
                  className="w-full h-12 text-base font-semibold gap-3 shadow-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700"
                >
                  <SteamIcon className="w-5 h-5 fill-current shrink-0" />
                  <span>Войти через Steam</span>
                </Button>
              </a>

              <p className="text-[11px] text-center text-muted-foreground">
                Авторизация безопасна и происходит напрямую на серверах valve steamcommunity.com
              </p>

              {/* Quick Dev / Test Login */}
              <div className="pt-2">
                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-neutral-800 w-full" />
                  <span className="bg-card px-2 text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    или быстрый тестовый вход
                  </span>
                  <div className="border-t border-neutral-800 w-full" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a href={`/api/auth/dev-login?role=USER&next=${encodeURIComponent(next)}`} className="block">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-medium border-neutral-800 hover:bg-neutral-800 text-neutral-300"
                    >
                      👤 Капитан / Игрок
                    </Button>
                  </a>
                  <a href={`/api/auth/dev-login?role=ADMIN&next=${encodeURIComponent(next)}`} className="block">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-medium border-neutral-800 hover:bg-neutral-800 text-amber-300 border-amber-500/20"
                    >
                      👑 Администратор
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Platform Highlights */}
            <div className="border-t border-neutral-800 pt-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-white shrink-0" />
                <span>Быстрый матчмейкинг праков с гибким выбором времени</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Swords className="w-4 h-4 text-white shrink-0" />
                <span>Интерактивное вето карт (BO1, BO2, BO3) в реальном времени</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-white shrink-0" />
                <span>Защищенные лобби и рейтинговая система доверия команд</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">Загрузка...</div>}>
      <LoginContent />
    </Suspense>
  );
}

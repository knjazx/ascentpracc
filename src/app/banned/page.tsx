'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldBan, MessageSquare, LogOut } from 'lucide-react';
import { useUser } from '@/hooks/useUser';

export default function BannedPage() {
  const { logout } = useUser();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg border-neutral-700 bg-card shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-neutral-600 via-neutral-400 to-neutral-600" />

        <CardHeader className="text-center pb-4 pt-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-500 border border-rose-500/40 mb-3 shadow-lg shadow-rose-950">
            <ShieldBan className="h-9 w-9 stroke-[2]" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-wider text-rose-400">
            Доступ заблокирован
          </CardTitle>
          <CardDescription className="text-rose-200/70 text-sm max-w-sm mx-auto mt-1">
            Ваш Steam-аккаунт был заблокирован администрацией за нарушение регламента лиги или систематические неявки (no-show).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          <div className="rounded-lg border border-border/80 bg-black/40 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Что это значит?</p>
            <p>Вы не можете создавать команды, откликаться на скримы, участвовать в вето и управлять матчами.</p>
            <p>Если вы считаете блокировку ошибочной, свяжитесь с судейской коллегией в официальном Discord-сервере.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="outline" className="w-full gap-2 border-neutral-700 text-white hover:bg-neutral-800">
                <MessageSquare className="w-4 h-4" />
                <span>Апелляция в Discord</span>
              </Button>
            </a>

            <Button
              variant="destructive"
              onClick={() => logout()}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Users,
  Swords,
  Trophy,
  AlertTriangle,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalMatches: number;
  activeDisputes: number;
  pendingReports: number;
  liveMatches: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="container py-8 max-w-6xl space-y-8">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2 text-white font-mono text-xs uppercase tracking-widest mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Панель управления судьи лиги</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Администраторский центр
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Модерация лиги: решение споров по счёту, жалобы, бан игроков и управление пулом карт CS2
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Пользователи</span>
            <p className="text-2xl font-extrabold font-mono text-foreground">
              {loading ? '-' : stats?.totalUsers}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Команды</span>
            <p className="text-2xl font-extrabold font-mono text-foreground">
              {loading ? '-' : stats?.totalTeams}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Всего матчей</span>
            <p className="text-2xl font-extrabold font-mono text-foreground">
              {loading ? '-' : stats?.totalMatches}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">Споры по счёту</span>
            <p className="text-2xl font-extrabold font-mono text-white">
              {loading ? '-' : stats?.activeDisputes}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">Жалобы</span>
            <p className="text-2xl font-extrabold font-mono text-white">
              {loading ? '-' : stats?.pendingReports}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">Live праки</span>
            <p className="text-2xl font-extrabold font-mono text-white">
              {loading ? '-' : stats?.liveMatches}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/disputes" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-white transition-colors">
                Диспуты и споры по счёту
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Просмотр разногласий команд при вводе результатов матчей, сверка скриншотов счёта и вынесение судейского решения.
              </p>
            </div>
            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-white">
              <span>Перейти к рассмотрению</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/reports" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-white transition-colors">
                Жалобы и технические неявки
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Фиксация неявок (No-Show), жалобы на оскорбления, токсичное поведение или срыв матчей командами.
              </p>
            </div>
            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-white">
              <span>Журнал жалоб</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/users" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                Пользователи и блокировки
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                База зарегистрированных игроков, быстрый поиск по Steam ID, блокировка/разблокировка нарушителей.
              </p>
            </div>
            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-primary">
              <span>Список игроков</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/maps" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-white transition-colors">
                Пул соревновательных карт
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Управление списком карт для драфта вето в BO1/BO2/BO3 (Mirage, Inferno, Nuke, Ancient, Anubis, Dust2...).
              </p>
            </div>
            <div className="pt-4 flex items-center justify-between text-xs font-semibold text-white">
              <span>Редактор пула карт</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

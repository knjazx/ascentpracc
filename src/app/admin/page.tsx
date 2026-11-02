'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Lock,
  User,
  LogOut,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Key,
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('knjazx');

  // Login form state
  const [loginInput, setLoginInput] = useState('knjazx');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 1. Check existing admin authorization
  const checkAdminAuth = async () => {
    try {
      const res = await fetch('/api/admin/check');
      const data = await res.json();
      if (data.success && data.isAdmin) {
        setIsAdmin(true);
        if (data.username) setAdminUsername(data.username);
        loadStats();
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginInput.trim(),
          password: passwordInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Неверный логин или пароль администратора');
      }

      setIsAdmin(true);
      setAdminUsername(data.user?.username || loginInput.trim());
      loadStats();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Ошибка при входе');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setIsAdmin(false);
    setPasswordInput('');
  };

  // Checking state
  if (isAdmin === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
          <span>Проверка прав доступа к панели управления...</span>
        </div>
      </div>
    );
  }

  // 1. Admin Login Screen (if not authenticated)
  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border border-[#262626] bg-[#0e0e0e] shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="text-center pt-8 pb-4 space-y-2 border-b border-[#1c1c1c] bg-[#121212]">
            <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-lg shadow-white/10">
              <Lock className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold block">
                Ascent Pracc Security
              </span>
              <CardTitle className="text-xl font-black uppercase tracking-wider text-white mt-1">
                Панель администратора
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-[#a1a1aa]">
              Введите логин и пароль администратора для входа в панель модерации лиги
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-white" />
                  <span>Логин администратора</span>
                </label>
                <Input
                  type="text"
                  placeholder="knjazx"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  required
                  className="bg-[#141414] border-[#2a2a2a] text-white font-mono h-11 focus-visible:ring-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-white" />
                  <span>Пароль доступа</span>
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  className="bg-[#141414] border-[#2a2a2a] text-white font-mono h-11 focus-visible:ring-white"
                />
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full h-11 bg-white text-black hover:bg-neutral-200 font-black tracking-wider uppercase text-xs rounded-xl gap-2 transition-all shadow-md"
                >
                  {loginLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{loginLoading ? 'Авторизация...' : 'Войти в панель'}</span>
                </Button>

                <div className="text-center pt-2">
                  <Link
                    href="/"
                    className="text-xs text-[#71717a] hover:text-white transition-colors inline-flex items-center gap-1 font-mono"
                  >
                    <span>← Вернуться на главную сайта</span>
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Authenticated Admin Dashboard
  return (
    <div className="container py-8 max-w-6xl space-y-8">
      {/* Top Admin Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[#222222] bg-[#111111] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base uppercase tracking-wider text-white font-mono">
                Админ-центр
              </span>
              <Badge variant="admin" className="font-mono text-[10px] px-2 py-0">
                {adminUsername}
              </Badge>
            </div>
            <span className="text-xs text-[#a1a1aa] block font-mono">
              Ascent Pracc Management Console
            </span>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/disputes">
            <Button variant="outline" size="sm" className="h-8 text-xs font-mono font-bold gap-1.5 border-[#2c2c2c] bg-[#161616] hover:bg-[#222] text-white">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Споры ({stats?.activeDisputes ?? 0})</span>
            </Button>
          </Link>

          <Link href="/admin/reports">
            <Button variant="outline" size="sm" className="h-8 text-xs font-mono font-bold gap-1.5 border-[#2c2c2c] bg-[#161616] hover:bg-[#222] text-white">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Жалобы ({stats?.pendingReports ?? 0})</span>
            </Button>
          </Link>

          <Link href="/admin/users">
            <Button variant="outline" size="sm" className="h-8 text-xs font-mono font-bold gap-1.5 border-[#2c2c2c] bg-[#161616] hover:bg-[#222] text-white">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Игроки</span>
            </Button>
          </Link>

          <Link href="/admin/maps">
            <Button variant="outline" size="sm" className="h-8 text-xs font-mono font-bold gap-1.5 border-[#2c2c2c] bg-[#161616] hover:bg-[#222] text-white">
              <MapPin className="w-3.5 h-3.5 text-purple-400" />
              <span>Карты</span>
            </Button>
          </Link>

          <Link href="/admin/codes">
            <Button variant="outline" size="sm" className="h-8 text-xs font-mono font-bold gap-1.5 border-[#2c2c2c] bg-[#161616] hover:bg-[#222] text-amber-400">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Коды PRO</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-8 text-xs font-mono font-bold gap-1.5 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </Button>

          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 text-xs font-mono text-neutral-400 hover:text-white gap-1">
              <span>На сайт</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Пользователи</span>
            <p className="text-2xl font-extrabold font-mono text-foreground">
              {statsLoading ? '-' : stats?.totalUsers}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Команды</span>
            <p className="text-2xl font-extrabold font-mono text-foreground">
              {statsLoading ? '-' : stats?.totalTeams}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Всего матчей</span>
            <p className="text-2xl font-extrabold font-mono text-foreground">
              {statsLoading ? '-' : stats?.totalMatches}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">Споры по счёту</span>
            <p className="text-2xl font-extrabold font-mono text-amber-400">
              {statsLoading ? '-' : stats?.activeDisputes}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">Жалобы</span>
            <p className="text-2xl font-extrabold font-mono text-rose-400">
              {statsLoading ? '-' : stats?.pendingReports}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-xl shadow-black/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase">Live праки</span>
            <p className="text-2xl font-extrabold font-mono text-emerald-400">
              {statsLoading ? '-' : stats?.liveMatches}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/disputes" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
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
              <span>Перейти к рассмотрению ({stats?.activeDisputes ?? 0})</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/reports" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
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
              <span>Журнал жалоб ({stats?.pendingReports ?? 0})</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/users" className="group">
          <Card className="border border-border bg-card hover:border-white/50 transition-all p-6 shadow-xl shadow-black/40 h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
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
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground group-hover:text-white transition-colors">
                Пул соревновательных карт
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Управление списком карт для драфта вето в BO1/BO3/BO5 (Mirage, Inferno, Nuke, Ancient, Anubis, Dust II, Cache, Vertigo).
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

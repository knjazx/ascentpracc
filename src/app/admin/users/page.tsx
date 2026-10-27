'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, ArrowLeft, Ban, CheckCircle, Shield } from 'lucide-react';
import Link from 'next/link';

interface AdminUser {
  id: string;
  steamId: string;
  nickname: string;
  avatarUrl: string;
  timezone: string;
  role: 'USER' | 'ADMIN';
  banned: boolean;
  createdAt: string;
  teams: Array<{
    team: { id: string; name: string; tag: string };
  }>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleBan = async (user: AdminUser) => {
    const action = user.banned ? 'разблокировать' : 'заблокировать';
    let reason = '';
    if (!user.banned) {
      const input = prompt(`Укажите причину блокировки игрока ${user.nickname}:`);
      if (input === null) return;
      reason = input.trim();
    } else {
      if (!confirm(`Вы действительно хотите ${action} игрока ${user.nickname}?`)) return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banned: !user.banned,
          reason: reason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при изменении статуса блокировки');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, banned: !user.banned } : u))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* Back and Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Назад в админ-панель</span>
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary" />
            <span>Управление игроками</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Поиск игроков по SteamID и никнейму, выдача прав и бан аккаунтов
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Steam ID или ник..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs w-60"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
            Найти
          </Button>
        </form>
      </div>

      {/* Users Table */}
      <Card className="border border-border bg-card shadow-xl shadow-black/40 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">
              Загрузка пользователей...
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Пользователи не найдены.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-mono uppercase text-[11px]">
                    <th className="py-3 px-4">Игрок</th>
                    <th className="py-3 px-3">Steam ID</th>
                    <th className="py-3 px-3">Роль</th>
                    <th className="py-3 px-3">Статус</th>
                    <th className="py-3 px-3">Команды</th>
                    <th className="py-3 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                      {/* Avatar and Nick */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatarUrl}
                            alt={u.nickname}
                            className="w-8 h-8 rounded-md bg-muted object-cover"
                          />
                          <span className="font-bold text-foreground text-sm">
                            {u.nickname}
                          </span>
                        </div>
                      </td>

                      {/* Steam ID */}
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        <a
                          href={`https://steamcommunity.com/profiles/${u.steamId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary transition-colors underline"
                        >
                          {u.steamId}
                        </a>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        {u.role === 'ADMIN' ? (
                          <Badge className="bg-white/10 text-white border-white/20 text-[10px] flex items-center gap-1 w-fit">
                            <Shield className="w-3 h-3" />
                            <span>ADMIN</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-neutral-700">
                            USER
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {u.banned ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Заблокирован
                          </Badge>
                        ) : (
                          <span className="text-emerald-400 font-semibold text-[11px]">
                            Активен
                          </span>
                        )}
                      </td>

                      {/* Teams */}
                      <td className="py-3 px-3 text-muted-foreground font-mono">
                        {u.teams.length > 0
                          ? u.teams.map((t) => `[${t.team.tag}]`).join(', ')
                          : '-'}
                      </td>

                      {/* Ban toggle button */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant={u.banned ? 'outline' : 'destructive'}
                          size="sm"
                          onClick={() => handleToggleBan(u)}
                          className="h-7 text-xs gap-1"
                        >
                          {u.banned ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              <span>Разбанить</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3 h-3" />
                              <span>Бан</span>
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

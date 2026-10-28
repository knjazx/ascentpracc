'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  UserPlus,
  Trash2,
  AlertCircle,
  Check,
  Save,
  ArrowLeft,
  AlertTriangle,
  Flame,
} from 'lucide-react';

interface TeamDetail {
  id: string;
  name: string;
  tag: string;
  logoUrl: string | null;
  description: string | null;
  discordInvite: string | null;
  avgElo: number | null;
  managers: Array<{
    isOwner: boolean;
    user: {
      id: string;
      nickname: string;
      avatarUrl: string;
      steamId: string;
    };
  }>;
}

export default function EditTeamPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user, refreshUser } = useUser();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [avgElo, setAvgElo] = useState('');
  const [discordInvite, setDiscordInvite] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [managerInput, setManagerInput] = useState('');
  const [addingManager, setAddingManager] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teams/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTeam(data.data);
        setName(data.data.name);
        setTag(data.data.tag);
        setDescription(data.data.description || '');
        setAvgElo(data.data.avgElo ? String(data.data.avgElo) : '');
        setDiscordInvite(data.data.discordInvite || '');
        setLogoUrl(data.data.logoUrl);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка загрузки файла');
      }
      setLogoUrl(data.data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          tag: tag.trim().toUpperCase(),
          description: description.trim() || null,
          avgElo: avgElo ? parseInt(avgElo, 10) : null,
          discordInvite: discordInvite.trim() || null,
          logoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при сохранении команды');
      }

      setSuccess('Данные команды успешно обновлены');
      await refreshUser();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerInput.trim()) return;

    setAddingManager(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${id}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: managerInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось добавить управляющего');
      }

      setManagerInput('');
      setSuccess('Со-управляющий успешно добавлен');
      await fetchTeam();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления');
    } finally {
      setAddingManager(false);
    }
  };

  const handleRemoveManager = async (managerUserId: string) => {
    if (!confirm('Вы уверены, что хотите удалить доступ для этого управляющего?')) return;

    try {
      const res = await fetch(`/api/teams/${id}/managers/${managerUserId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при удалении');
      }
      await fetchTeam();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка при удалении');
    }
  };

  const handleDeleteTeam = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось удалить команду');
      }

      await refreshUser();
      router.push('/teams');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении команды');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-12 text-center text-muted-foreground animate-pulse">
        Загрузка данных команды...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="container py-16 text-center space-y-4">
        <p>Команда не найдена.</p>
        <Link href="/teams">
          <Button variant="outline">К списку команд</Button>
        </Link>
      </div>
    );
  }

  const isOwner = team.managers.some((m) => m.user.id === user?.id && m.isOwner) || user?.role === 'ADMIN';

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link href={`/teams/${team.id}`} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Вернуться к профилю команды</span>
        </Link>
        <span className="text-xs font-mono text-muted-foreground">ID: {team.id}</span>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-foreground">
          Управление командой <span className="text-white">[{team.tag}]</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          Редактирование профиля, управление доступом со-капитанов и удаление.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-neutral-700 bg-neutral-900/80 p-3.5 text-neutral-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-white" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-white/20 bg-white/5 p-3.5 text-white text-sm">
          <Check className="w-5 h-5 shrink-0 mt-0.5 text-white" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Info Form */}
      <Card className="border border-border bg-card shadow-xl shadow-black/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Основная информация</CardTitle>
          <CardDescription>Измените логотип, название или контактные данные.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTeam} className="space-y-5">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-xl border border-dashed border-border hover:border-white bg-cs-panel cursor-pointer flex flex-col items-center justify-center overflow-hidden transition-all shrink-0"
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Загрузка...' : 'Сменить логотип'}
                </Button>
                <p className="text-[11px]">PNG, JPEG, WEBP до 2 МБ</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Название команды
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={32}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Тег
                </label>
                <Input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  minLength={2}
                  maxLength={8}
                  className="font-mono uppercase font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Описание
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="flex w-full rounded-md border border-border bg-cs-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white resize-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-white" />
                  <span>Средний Faceit ELO (AVG ELO)</span>
                </label>
                <span className="text-[11px] text-muted-foreground">Необязательно</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={100}
                  max={5000}
                  placeholder="например: 2150"
                  value={avgElo}
                  onChange={(e) => setAvgElo(e.target.value)}
                  className="font-mono text-white placeholder:text-muted-foreground/60 pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground uppercase pointer-events-none">
                  ELO
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Discord инвайт
              </label>
              <Input
                type="url"
                value={discordInvite}
                onChange={(e) => setDiscordInvite(e.target.value)}
                placeholder="https://discord.gg/..."
              />
            </div>

            <Button type="submit" variant="cs" disabled={saving} className="gap-2 font-bold">
              <Save className="w-4 h-4" />
              <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Managers Management */}
      <Card className="border border-border bg-card shadow-xl shadow-black/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Со-управляющие командой</CardTitle>
          <CardDescription>
            Со-управляющие имеют право создавать заявки, откликаться на скримы и вводить счет матча от имени этой команды.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add manager form */}
          {isOwner && (
            <form onSubmit={handleAddManager} className="flex gap-2">
              <Input
                type="text"
                placeholder="Введите Steam-никнейм или 17-значный SteamID64..."
                value={managerInput}
                onChange={(e) => setManagerInput(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit" variant="secondary" disabled={addingManager} className="gap-2 shrink-0">
                <UserPlus className="w-4 h-4" />
                <span>{addingManager ? 'Добавление...' : 'Добавить'}</span>
              </Button>
            </form>
          )}

          {/* Managers List */}
          <div className="space-y-2">
            {team.managers.map((m) => (
              <div
                key={m.user.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-cs-panel"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={m.user.avatarUrl} alt={m.user.nickname} fallback={m.user.nickname} size="default" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{m.user.nickname}</p>
                      {m.isOwner && <Badge variant="cs" className="text-[10px] px-1.5 py-0">Владелец</Badge>}
                    </div>
                  </div>
                </div>

                {!m.isOwner && isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveManager(m.user.id)}
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone: Delete Team */}
      {isOwner && (
        <Card className="border-rose-500/30 bg-rose-500/[0.03]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Опасная зона</span>
            </CardTitle>
            <CardDescription className="text-rose-300/70">
              Удаление команды необратимо. Команду можно удалить только при отсутствии активных матчей.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!confirmDelete ? (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                className="text-xs"
              >
                Удалить команду
              </Button>
            ) : (
              <div className="space-y-3 p-4 rounded-lg border border-rose-500/40 bg-rose-500/10">
                <p className="text-xs font-semibold text-rose-200">
                  Вы действительно хотите безвозвратно удалить команду «{team.name}»?
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteTeam}
                    disabled={deleting}
                    className="text-xs font-bold"
                  >
                    {deleting ? 'Удаление...' : 'Да, окончательно удалить'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

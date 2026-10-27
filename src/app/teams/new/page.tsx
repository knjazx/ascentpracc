'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';
import { Users, Upload, AlertCircle, CheckCircle2, Flame } from 'lucide-react';

export default function CreateTeamPage() {
  const router = useRouter();
  const { user, refreshUser } = useUser();

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [avgElo, setAvgElo] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        throw new Error(data.error || 'Ошибка при загрузке логотипа');
      }
      setLogoUrl(data.data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          tag: tag.trim().toUpperCase(),
          description: description.trim() || null,
          avgElo: avgElo ? parseInt(avgElo, 10) : null,
          logoUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при создании команды');
      }

      await refreshUser();
      router.push(`/teams/${data.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла непредвиденная ошибка');
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container max-w-md py-16 text-center space-y-4">
        <p className="text-muted-foreground">Для создания команды необходимо войти через Steam.</p>
        <Button variant="cs" onClick={() => router.push('/api/auth/steam')}>
          Войти через Steam
        </Button>
      </div>
    );
  }

  // Enforce 1 team limit
  if (user.teams && user.teams.length >= 1) {
    const existingTeam = user.teams[0];
    return (
      <div className="container max-w-lg py-16">
        <Card className="border-neutral-800 bg-neutral-950/95 shadow-2xl p-6 sm:p-8 text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neutral-600 via-white to-neutral-600" />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white border border-white/20 shadow-lg">
            <Users className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
              Лимит команд исчерпан
            </h2>
            <p className="text-sm text-neutral-400">
              На платформе действует правило: один игрок может состоять только в <span className="text-white font-bold">1 команде</span>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-between gap-3 text-left">
            <div>
              <p className="font-bold text-white text-base">{existingTeam.name}</p>
              <p className="text-xs font-mono text-neutral-400 font-semibold">[{existingTeam.tag}]</p>
            </div>
            <Link href={`/teams/${existingTeam.id}`}>
              <Button variant="outline" size="sm" className="text-xs font-medium hover:border-white">
                Профиль команды
              </Button>
            </Link>
          </div>

          <div className="pt-2">
            <Link href={`/teams/${existingTeam.id}/edit`}>
              <Button variant="cs" className="w-full font-bold">
                Управление командой
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card className="border-neutral-800 bg-neutral-950/95 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-neutral-600 via-white to-neutral-600" />

        <CardHeader className="text-center pb-4 pt-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white border border-white/20 mb-3 shadow-lg">
            <Users className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-wider text-white">
            Создание команды
          </CardTitle>
          <CardDescription className="text-neutral-400 text-sm max-w-md mx-auto">
            Команда выступает карточкой для поиска праков. Вы станете ее владельцем и сможете управлять заявками и со-капитанами.
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-neutral-700 bg-neutral-900 p-3.5 text-neutral-200 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-white" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Logo Upload Preview */}
            <div className="flex flex-col items-center justify-center space-y-3 pb-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-white bg-neutral-900 cursor-pointer flex flex-col items-center justify-center overflow-hidden transition-all group"
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo Preview"
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-neutral-400 group-hover:text-white transition-colors" />
                    <span className="text-[10px] text-neutral-400 mt-1 uppercase font-semibold">
                      {uploading ? 'Загрузка...' : 'Логотип'}
                    </span>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <p className="text-[11px] text-neutral-400 text-center">
                PNG, JPEG или WEBP до 2 МБ. Нажмите для выбора.
              </p>
            </div>

            {/* Name & Tag Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Название команды *
                </label>
                <Input
                  type="text"
                  placeholder="например: Natus Vincere"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={32}
                  className="bg-neutral-900 border-neutral-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Тег команды *
                </label>
                <Input
                  type="text"
                  placeholder="NAVI"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  minLength={2}
                  maxLength={8}
                  className="font-mono uppercase font-bold bg-neutral-900 border-neutral-800"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Описание команды
              </label>
              <textarea
                rows={3}
                placeholder="Краткая информация о команде, средний ELO / Faceit уровень, цели..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="flex w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white resize-none"
              />
            </div>

            {/* Average ELO */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-white" />
                  <span>Средний Faceit ELO (AVG ELO)</span>
                </label>
                <span className="text-[11px] text-neutral-500">Необязательно</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={100}
                  max={5000}
                  placeholder="например: 2150"
                  value={avgElo}
                  onChange={(e) => setAvgElo(e.target.value)}
                  className="font-mono text-white placeholder:text-neutral-500 pr-16 bg-neutral-900 border-neutral-800"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-400 uppercase pointer-events-none">
                  ELO
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">
                Укажите средний Faceit ELO ростера (от 100 до 5000). Помогает подбирать равных соперников на праки.
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="cs"
              size="lg"
              disabled={loading || uploading}
              className="w-full gap-2 mt-4 font-bold tracking-wider"
            >
              {loading ? (
                <span>Создание...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>Зарегистрировать команду</span>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

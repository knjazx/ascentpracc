'use client';

import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Eye, EyeOff, Copy, Check, ExternalLink, Edit2, Link as LinkIcon } from 'lucide-react';

export interface ServerInfoData {
  ip: string;
  port?: number;
  password?: string;
  tvPort?: number;
  connectUrl?: string;
  byTeamId?: string;
}

interface ServerInfoCardProps {
  matchId: string;
  serverInfo: ServerInfoData | null;
  canEdit: boolean;
  socket: Socket | null;
}

export function ServerInfoCard({
  matchId,
  serverInfo: initialServerInfo,
  canEdit,
  socket,
}: ServerInfoCardProps) {
  const [serverInfo, setServerInfo] = useState<ServerInfoData | null>(initialServerInfo);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [serverLink, setServerLink] = useState(
    serverInfo?.connectUrl || serverInfo?.ip || ''
  );
  const [password, setPassword] = useState(serverInfo?.password || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize when serverInfo prop changes
  useEffect(() => {
    if (initialServerInfo) {
      setServerInfo(initialServerInfo);
      setServerLink(initialServerInfo.connectUrl || initialServerInfo.ip || '');
      setPassword(initialServerInfo.password || '');
    }
  }, [initialServerInfo]);

  // Listen to live server updates
  useEffect(() => {
    if (!socket) return;

    const handleServerUpdated = (newInfo: ServerInfoData) => {
      setServerInfo(newInfo);
      setServerLink(newInfo.connectUrl || newInfo.ip || '');
      if (newInfo.password !== undefined) {
        setPassword(newInfo.password);
      }
    };

    socket.on('server_info_updated', handleServerUpdated);
    return () => {
      socket.off('server_info_updated', handleServerUpdated);
    };
  }, [socket]);

  const handleCopyLink = () => {
    const linkToCopy = serverInfo?.connectUrl || serverInfo?.ip;
    if (!linkToCopy) return;

    navigator.clipboard.writeText(linkToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPassword = () => {
    if (!serverInfo?.password) return;

    navigator.clipboard.writeText(serverInfo.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;

    const cleanLink = serverLink.trim();
    if (!cleanLink) {
      setError('Укажите ссылку на сервер');
      return;
    }

    setSaving(true);
    setError(null);

    const cleanPass = password.trim() || undefined;

    const payload = {
      matchId,
      serverInfo: {
        ip: cleanLink,
        connectUrl: cleanLink,
        password: cleanPass,
      },
    };

    socket.emit('update_server_info', payload, (res: { success: boolean; error?: string }) => {
      setSaving(false);
      if (res.success) {
        setIsEditing(false);
      } else {
        setError(res.error || 'Ошибка при сохранении данных сервера');
      }
    });
  };

  const getSafeHref = (raw: string) => {
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('steam://')) {
      return raw;
    }
    return `https://${raw}`;
  };

  const displayLink = serverInfo?.connectUrl || serverInfo?.ip || '';

  return (
    <Card className="border border-border bg-card shadow-xl shadow-black/40 relative overflow-hidden">
      <CardHeader className="py-3.5 px-4 border-b border-border bg-cs-panel flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-white" />
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
            Данные CS2 Сервера
          </CardTitle>
        </div>

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="h-7 text-xs gap-1.5"
          >
            <Edit2 className="w-3 h-3" />
            <span>{isEditing ? 'Закрыть' : 'Настроить сервер'}</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-3.5">
            {error && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-muted-foreground">
                Ссылка
              </label>
              <Input
                type="text"
                placeholder="https://..."
                value={serverLink}
                onChange={(e) => setServerLink(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-muted-foreground">
                Пароль
              </label>
              <Input
                type="text"
                placeholder="если есть"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="cs" size="sm" disabled={saving} className="flex-1 text-xs font-bold">
                {saving ? 'Сохранение...' : 'Сохранить и оповестить лобби'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="text-xs"
              >
                Отмена
              </Button>
            </div>
          </form>
        ) : serverInfo ? (
          <div className="p-3.5 rounded-xl border border-border/60 bg-cs-panel/40 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 space-y-1 flex-1">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">
                Ссылка:
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <a
                  href={getSafeHref(displayLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-white text-sm hover:text-amber-300 transition-colors truncate max-w-full inline-flex items-center gap-1.5 underline underline-offset-4"
                  title="Открыть ссылку на сервер"
                >
                  <span className="truncate">{displayLink}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-muted-foreground hover:text-white p-1 rounded transition-colors shrink-0"
                  title="Скопировать ссылку"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {serverInfo.password && (
              <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-border/60 text-xs">
                  <span className="text-muted-foreground">Пароль:</span>
                  <span className="font-bold text-white font-mono select-all">
                    {showPassword ? serverInfo.password : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground ml-1 p-0.5"
                    title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="text-muted-foreground hover:text-foreground ml-0.5 p-0.5"
                    title="Скопировать пароль"
                  >
                    {copiedPassword ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-5 space-y-3 text-xs text-muted-foreground">
            <p>Данные сервера еще не заполнены организатором.</p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-xs font-semibold gap-1.5 border-white/20 hover:border-white hover:text-white transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5 text-white/70" />
                <span>Ввести ссылку и пароль сервера</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

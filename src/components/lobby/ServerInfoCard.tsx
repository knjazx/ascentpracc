'use client';

import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Eye, EyeOff, Copy, Check, ExternalLink, Edit2, ShieldCheck } from 'lucide-react';

export interface ServerInfoData {
  ip: string;
  port: number;
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
  const [copied, setCopied] = useState(false);

  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [ip, setIp] = useState(serverInfo?.ip || '');
  const [port, setPort] = useState(String(serverInfo?.port || 27015));
  const [password, setPassword] = useState(serverInfo?.password || '');
  const [tvPort, setTvPort] = useState(String(serverInfo?.tvPort || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen to live server updates
  useEffect(() => {
    if (!socket) return;

    const handleServerUpdated = (newInfo: ServerInfoData) => {
      setServerInfo(newInfo);
    };

    socket.on('server_info_updated', handleServerUpdated);
    return () => {
      socket.off('server_info_updated', handleServerUpdated);
    };
  }, [socket]);

  const handleCopyConnect = () => {
    if (!serverInfo) return;
    const connectCmd = `connect ${serverInfo.ip}:${serverInfo.port}${
      serverInfo.password ? `; password ${serverInfo.password}` : ''
    }`;
    navigator.clipboard.writeText(connectCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;

    setSaving(true);
    setError(null);

    const payload = {
      matchId,
      serverInfo: {
        ip: ip.trim(),
        port: parseInt(port, 10) || 27015,
        password: password.trim() || undefined,
        tvPort: tvPort ? parseInt(tvPort, 10) : undefined,
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
          <form onSubmit={handleSave} className="space-y-3">
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">IP адрес сервера *</label>
                <Input
                  type="text"
                  placeholder="127.0.0.1 или cs2.myserver.com"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">Порт *</label>
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">Пароль сервера</label>
                <Input
                  type="text"
                  placeholder="scrim123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">GOTV порт</label>
                <Input
                  type="number"
                  placeholder="27020"
                  value={tvPort}
                  onChange={(e) => setTvPort(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-1">
              <Button type="submit" variant="cs" size="sm" disabled={saving} className="w-full text-xs font-bold">
                {saving ? 'Сохранение...' : 'Сохранить и оповестить лобби'}
              </Button>
            </div>
          </form>
        ) : serverInfo ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border/60 bg-cs-panel/40 font-mono text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase block">Адрес подключения:</span>
                <span className="font-bold text-foreground text-sm tracking-wider">
                  {serverInfo.ip}:{serverInfo.port}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {serverInfo.password && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-border/60 text-xs">
                    <span className="text-muted-foreground">Пароль:</span>
                    <span className="font-bold text-white">
                      {showPassword ? serverInfo.password : '••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground hover:text-foreground ml-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons: steam:// connect + copy connect command */}
            <div className="flex gap-2">
              <a
                href={
                  serverInfo.connectUrl ||
                  `steam://connect/${serverInfo.ip}:${serverInfo.port}${
                    serverInfo.password ? '/' + serverInfo.password : ''
                  }`
                }
                className="flex-1"
              >
                <Button variant="cs" size="sm" className="w-full gap-2 text-xs font-bold">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Подключиться к серверу (Steam)</span>
                </Button>
              </a>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyConnect}
                className="gap-1.5 text-xs font-mono shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано!' : 'Консоль'}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-2 text-xs text-muted-foreground">
            <p>Данные сервера еще не заполнены организатором.</p>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="text-xs">
                Ввести IP и пароль сервера
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

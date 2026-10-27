'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, Trash2, ArrowRight, ShieldAlert, Swords, Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { formatUtcToZoned } from '@/lib/date';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user, refreshUser } = useUser();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Очистить все уведомления?')) return;
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
      setNotifications([]);
      refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'MATCH_REMINDER':
        return <Clock className="w-4 h-4 text-white" />;
      case 'MATCH_AUTO_CONFIRMED':
      case 'MATCH_CONFIRMED':
        return <Swords className="w-4 h-4 text-white" />;
      case 'NO_SHOW_ALERT':
        return <ShieldAlert className="w-4 h-4 text-neutral-300" />;
      case 'MATCH_RATED':
        return <Star className="w-4 h-4 text-white" />;
      default:
        return <Bell className="w-4 h-4 text-white" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container py-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-white" />
            <span>Центр уведомлений</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            События ваших матчей, отклики на праки и важные оповещения
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs gap-1.5 h-8 border-neutral-700 text-white hover:bg-neutral-800"
              >
                <CheckCheck className="w-3.5 h-3.5 text-white" />
                <span>Прочитать все</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5 h-8"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground animate-pulse text-sm">
          Загрузка уведомлений...
        </div>
      ) : notifications.length === 0 ? (
        <Card className="border border-border bg-card shadow-xl py-16 text-center">
          <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">У вас пока нет уведомлений</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const dateStr = formatUtcToZoned(
              n.createdAt,
              user?.timezone || 'Europe/Kyiv',
              'dd.MM.yyyy HH:mm'
            );

            return (
              <Card
                key={n.id}
                className={`border transition-all ${
                  !n.read
                    ? 'border-white/40 bg-card shadow-xl shadow-black/40'
                    : 'border-border bg-cs-panel opacity-85'
                }`}
              >
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-card border border-border shrink-0 mt-0.5">
                      {getIconForType(n.type)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{n.title}</p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {n.message}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 font-mono block">
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {n.link && (
                      <Link href={n.link} onClick={() => !n.read && handleMarkAsRead(n.id)}>
                        <Button variant="secondary" size="sm" className="h-8 text-xs gap-1">
                          <span>Перейти</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

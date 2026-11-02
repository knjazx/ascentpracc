'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  LogOut,
  Settings,
  Users,
  PlusCircle,
  Bell,
  ChevronDown,
  Lock,
  Swords,
  Sparkles,
} from 'lucide-react';
import { SteamIcon } from '@/components/icons/SteamIcon';

export function UserMenu() {
  const { user, loading, logout } = useUser();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-muted"></div>
        <div className="w-20 h-4 rounded bg-muted hidden sm:block"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Link href="/api/auth/steam">
        <Button variant="steam" size="sm" className="gap-2 font-medium">
          <SteamIcon className="w-4 h-4 fill-current shrink-0" />
          <span>Войти через Steam</span>
        </Button>
      </Link>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={isOpen}
      >
        <Avatar src={user.avatarUrl} alt={user.nickname} fallback={user.nickname} size="default" />
        <div className="text-left hidden md:flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground leading-tight max-w-[120px] truncate">
            {user.nickname}
          </span>
          {user.isPro && (
            <span className="px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black font-mono text-[9px] uppercase tracking-wider">
              PRO
            </span>
          )}
          {user.role === 'ADMIN' && (
            <Badge variant="admin" className="text-[10px] px-1.5 py-0">
              ADMIN
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-foreground' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* User quick info header */}
          <div className="px-3 py-2.5 border-b border-border/60 mb-1 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Профиль</p>
              <p className="text-sm font-bold text-foreground truncate mt-0.5">{user.nickname}</p>
            </div>
            {user.isPro && (
              <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black font-mono text-[9px] uppercase tracking-wider shadow">
                PRO
              </span>
            )}
          </div>

          {/* Subscription Link */}
          <div className="py-1 border-b border-border/60 mb-1">
            <Link
              href="/subscription"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors text-amber-400"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Подписка PRO</span>
              </div>
              {user.isPro ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                  АКТИВНА
                </span>
              ) : (
                <span className="text-[10px] text-neutral-400 font-mono">
                  Free
                </span>
              )}
            </Link>
          </div>

          {/* Active Match Jump Link */}
          {user.activeMatch && (
            <div className="p-1 mb-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Link
                href={`/lobby/${user.activeMatch.id}`}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-2 py-1.5 text-xs font-bold text-emerald-400 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5 font-mono truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="truncate">В лобби: [{user.activeMatch.teamA.tag}] vs [{user.activeMatch.teamB.tag}]</span>
                </div>
              </Link>
            </div>
          )}

          {/* Teams Section */}
          <div className="py-1">
            <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>{user.teams.length >= 1 ? 'Моя команда' : 'Команда'}</span>
              {user.teams.length === 0 && (
                <Link
                  href="/teams/new"
                  onClick={() => setIsOpen(false)}
                  className="text-primary hover:underline flex items-center gap-1 text-[11px] normal-case"
                >
                  <PlusCircle className="w-3 h-3" />
                  Создать
                </Link>
              )}
            </div>

            {user.teams.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                У вас пока нет команды.{' '}
                <Link
                  href="/teams/new"
                  onClick={() => setIsOpen(false)}
                  className="text-primary hover:underline"
                >
                  Создайте свою команду
                </Link>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-32 overflow-y-auto pr-1">
                {user.teams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-1.5 text-xs rounded-md hover:bg-white/5 text-foreground transition-colors"
                  >
                    <span className="truncate font-medium">{team.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">[{team.tag}]</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 my-1" />

          {/* Navigation Links */}
          <div className="space-y-0.5">
            <Link
              href="/matches?my=true"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md hover:bg-white/5 text-foreground transition-colors"
            >
              <Swords className="w-4 h-4 text-emerald-400" />
              <span>Мои матчи и лобби</span>
            </Link>

            <Link
              href="/teams"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md hover:bg-white/5 text-foreground transition-colors"
            >
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>Все команды</span>
            </Link>

            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md hover:bg-white/5 text-foreground transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span>Уведомления</span>
              </div>
              {user.unreadNotifications > 0 && (
                <span className="px-1.5 py-0.2 bg-primary text-black font-bold text-[10px] rounded-full">
                  {user.unreadNotifications}
                </span>
              )}
            </Link>

            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md hover:bg-white/5 text-foreground transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span>Настройки профиля</span>
            </Link>

            {user.role === 'ADMIN' && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Админ-панель</span>
              </Link>
            )}
          </div>

          <div className="border-t border-border/60 my-1" />

          {/* Logout Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      )}
    </div>
  );
}

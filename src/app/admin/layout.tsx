'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LogOut,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Users,
  MapPin,
  LayoutDashboard,
  Loader2,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('knjazx');

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        if (data.success && data.isAdmin) {
          setIsAdmin(true);
          if (data.username) setAdminUsername(data.username);
        } else {
          setIsAdmin(false);
          // If on a subroute like /admin/disputes, redirect to /admin to login
          if (pathname !== '/admin') {
            router.push('/admin');
          }
        }
      } catch {
        setIsAdmin(false);
        if (pathname !== '/admin') {
          router.push('/admin');
        }
      }
    }
    checkAuth();
  }, [pathname, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    router.push('/admin');
    window.location.reload();
  };

  // If on /admin, page.tsx handles its own view (login or dashboard)
  if (pathname === '/admin') {
    return <>{children}</>;
  }

  // If checking auth or not admin on subroutes, show loader while redirecting
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
          <span>Перенаправление на страницу входа администратора...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Обзор', icon: LayoutDashboard },
    { href: '/admin/codes', label: 'Коды PRO', icon: Key },
    { href: '/admin/disputes', label: 'Споры', icon: AlertTriangle },
    { href: '/admin/reports', label: 'Жалобы', icon: ShieldAlert },
    { href: '/admin/users', label: 'Игроки', icon: Users },
    { href: '/admin/maps', label: 'Карты', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Subpage Admin Nav Header */}
      <header className="border-b border-[#222222] bg-[#0c0c0c]/80 backdrop-blur sticky top-0 z-40">
        <div className="container max-w-6xl flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-mono font-black text-sm uppercase text-white tracking-wider">
                ADMIN
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-1 font-mono text-xs">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                      isActive
                        ? 'bg-white text-black'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-[#181818]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge variant="admin" className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5">
              {adminUsername}
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="h-8 text-xs font-mono font-bold text-rose-400 border-rose-500/30 hover:bg-rose-500/10 gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>

            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs font-mono text-[#a1a1aa] hover:text-white gap-1">
                <span>Сайт</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

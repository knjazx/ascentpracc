'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/header/UserMenu';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/useUser';
import {
  Crosshair,
  Swords,
  Users,
  Trophy,
  Plus,
  Bell,
  Menu,
  X,
  Flame,
} from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Праки', icon: Crosshair },
    { href: '/teams', label: 'Команды', icon: Users },
    { href: '/matches', label: 'Матчи', icon: Swords },
    { href: '/leaderboard', label: 'Лидерборд', icon: Trophy },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#222222] bg-[#0a0a0a]/95 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-8 h-8 shrink-0 transition-transform duration-300 group-hover:scale-110">
              <Image
                src="/images/ascent-icon.png"
                alt="Ascent Pracc"
                width={32}
                height={32}
                className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(255,255,255,0.25)] group-hover:drop-shadow-[0_0_16px_rgba(255,255,255,0.5)] transition-all"
                priority
              />
            </div>
            <span className="font-black text-lg tracking-wider uppercase text-white font-mono">
              ASCENT<span className="text-[#a1a1aa]">.PRACC</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    active
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-black' : 'text-[#a1a1aa]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              {/* Notification bell */}
              <Link href="/notifications">
                <button
                  aria-label="Уведомления"
                  className="relative p-2 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Bell className="w-5 h-5" />
                  {user.unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black ring-2 ring-[#0a0a0a]">
                      {user.unreadNotifications > 9 ? '9+' : user.unreadNotifications}
                    </span>
                  )}
                </button>
              </Link>

              {/* Create Scrim Fast Action */}
              <Link href="/scrims/new" className="hidden sm:inline-flex">
                <Button variant="cs" size="sm" className="gap-1.5 text-xs font-bold tracking-wider">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Создать заявку</span>
                </Button>
              </Link>
            </>
          )}

          {/* User Menu / Steam Login */}
          <UserMenu />

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            aria-label="Меню"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#222222] bg-[#0a0a0a] px-4 py-3 space-y-2 animate-in slide-in-from-top-2 shadow-2xl">
          <nav className="flex flex-col gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white text-black font-bold'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-black' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {user && (
              <Link
                href="/scrims/new"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 mt-2 px-3 py-2.5 rounded-lg bg-white text-black font-bold uppercase tracking-wider text-xs shadow-md"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Создать заявку на прак</span>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

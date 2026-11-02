'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { Swords, Radio, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ActiveMatchBanner() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const activeMatch = user?.activeMatch;

  if (!activeMatch) {
    return null;
  }

  // Do not show banner if the user is already inside this lobby
  if (pathname === `/lobby/${activeMatch.id}`) {
    return null;
  }

  return (
    <aside aria-label="Активный матч" className="w-full bg-gradient-to-r from-[#0a0a0c] via-[#111114] to-[#0a0a0c] border-b border-emerald-500/30 shadow-lg shadow-black/50 py-2.5 px-4 sticky top-16 z-30">
      <div className="container max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>

          <div className="flex items-center gap-2 truncate font-mono text-white">
            <Swords className="w-4 h-4 text-emerald-400 shrink-0 hidden sm:inline-block" />
            <span className="font-bold truncate text-white">
              [{activeMatch.teamA.tag}] {activeMatch.teamA.name}
            </span>
            <span className="text-neutral-500 font-bold text-xs">vs</span>
            <span className="font-bold truncate text-white">
              [{activeMatch.teamB.tag}] {activeMatch.teamB.name}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-neutral-300 font-semibold hidden md:inline-block font-mono">
              {activeMatch.format}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <Link href={`/lobby/${activeMatch.id}`}>
            <Button
              size="sm"
              className="h-8 gap-1.5 font-mono text-xs font-bold uppercase tracking-wider bg-emerald-500 text-black hover:bg-emerald-400 shadow-md transition-all group"
            >
              <span>В лобби матча</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  );
}

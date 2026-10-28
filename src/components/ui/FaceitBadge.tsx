'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { getFaceitLevelByElo } from '@/lib/faceit';

interface FaceitBadgeProps {
  elo?: number | null;
  showElo?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FaceitBadge({
  elo,
  showElo = true,
  size = 'md',
  className = '',
}: FaceitBadgeProps) {
  const [imgError, setImgError] = useState(false);
  const info = getFaceitLevelByElo(elo);

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24,
  };

  const px = iconSizes[size] || 18;

  if (!info) {
    return (
      <span
        className={`font-mono font-medium text-xs px-2.5 py-1 rounded-md bg-[#161616] border border-[#242424] text-[#71717a] inline-flex items-center gap-1.5 select-none ${className}`}
        title="FACEIT: Без рейтинга (Unranked)"
      >
        <Image
          src="/images/faceit/unranked.svg"
          alt="Unranked"
          width={px}
          height={px}
          className="opacity-50 shrink-0"
          unoptimized
        />
        <span>Unranked</span>
      </span>
    );
  }

  return (
    <span
      className={`font-mono font-bold text-xs px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 select-none transition-colors ${info.badgeBg} ${info.badgeBorder} ${info.textColor} ${className}`}
      title={`FACEIT ${info.name} • ${info.rangeText}`}
    >
      {!imgError ? (
        <Image
          src={info.icon}
          alt={info.name}
          width={px}
          height={px}
          className="shrink-0"
          unoptimized
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-black"
        >
          {info.level}
        </span>
      )}
      {showElo && <span className="font-mono">{elo} ELO</span>}
    </span>
  );
}

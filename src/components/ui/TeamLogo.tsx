'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface TeamLogoProps {
  logoUrl?: string | null;
  name: string;
  tag: string;
  size?: number;
  className?: string;
  shape?: 'rounded' | 'circle' | 'square';
  priority?: boolean;
}

export const TeamLogo = React.memo(function TeamLogo({
  logoUrl,
  name,
  tag,
  size = 48,
  className = '',
  shape = 'rounded',
  priority = false,
}: TeamLogoProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error when logoUrl changes (e.g. after editing or uploading)
  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  const initials = (tag || name.slice(0, 3) || 'CS').toUpperCase().slice(0, 4);

  const roundedCls =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'square'
      ? 'rounded-none'
      : 'rounded-xl';

  const isValidUrl =
    Boolean(logoUrl) &&
    !hasError &&
    (logoUrl!.startsWith('http://') ||
      logoUrl!.startsWith('https://') ||
      logoUrl!.startsWith('/') ||
      logoUrl!.startsWith('data:image/'));

  if (!isValidUrl) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-[#222222] via-[#161616] to-[#0c0c0c] border border-white/5 select-none text-white overflow-hidden ${roundedCls} ${className}`}
        title={name}
      >
        <span
          className="font-mono font-black tracking-wider text-white/90 drop-shadow select-none"
          style={{ fontSize: Math.max(9, Math.floor(size * 0.3)) }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${roundedCls} ${className}`}>
      <Image
        src={logoUrl!}
        alt={name}
        width={size}
        height={size}
        className="object-cover w-full h-full select-none"
        unoptimized
        priority={priority}
        onError={() => setHasError(true)}
      />
    </div>
  );
});

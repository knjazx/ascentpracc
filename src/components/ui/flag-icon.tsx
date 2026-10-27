import React from 'react';

interface FlagIconProps {
  country: string;
  className?: string;
  size?: number;
}

export function FlagIcon({ country, className = '', size = 20 }: FlagIconProps) {
  const c = country.toUpperCase();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`rounded-full shrink-0 shadow-sm border border-white/10 ${className}`}
      style={{ minWidth: size, minHeight: size }}
    >
      <defs>
        <clipPath id={`flag-clip-${c}-${size}`}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <g clipPath={`url(#flag-clip-${c}-${size})`}>
        {c === 'UA' && (
          <>
            <rect width="32" height="16" fill="#2563eb" />
            <rect y="16" width="32" height="16" fill="#ffd100" />
          </>
        )}
        {c === 'PL' && (
          <>
            <rect width="32" height="16" fill="#ffffff" />
            <rect y="16" width="32" height="16" fill="#dc2626" />
          </>
        )}
        {c === 'LT' && (
          <>
            <rect y="0" width="32" height="10.66" fill="#facc15" />
            <rect y="10.66" width="32" height="10.66" fill="#16a34a" />
            <rect y="21.33" width="32" height="10.66" fill="#dc2626" />
          </>
        )}
        {c === 'DE' && (
          <>
            <rect y="0" width="32" height="10.66" fill="#18181b" />
            <rect y="10.66" width="32" height="10.66" fill="#dc2626" />
            <rect y="21.33" width="32" height="10.66" fill="#facc15" />
          </>
        )}
        {c === 'FR' && (
          <>
            <rect x="0" width="10.66" height="32" fill="#2563eb" />
            <rect x="10.66" width="10.66" height="32" fill="#ffffff" />
            <rect x="21.33" width="10.66" height="32" fill="#dc2626" />
          </>
        )}
        {c === 'RU' && (
          <>
            <rect y="0" width="32" height="10.66" fill="#ffffff" />
            <rect y="10.66" width="32" height="10.66" fill="#2563eb" />
            <rect y="21.33" width="32" height="10.66" fill="#dc2626" />
          </>
        )}
        {c === 'RO' && (
          <>
            <rect x="0" width="10.66" height="32" fill="#1d4ed8" />
            <rect x="10.66" width="10.66" height="32" fill="#facc15" />
            <rect x="21.33" width="10.66" height="32" fill="#dc2626" />
          </>
        )}
        {c === 'NL' && (
          <>
            <rect y="0" width="32" height="10.66" fill="#dc2626" />
            <rect y="10.66" width="32" height="10.66" fill="#ffffff" />
            <rect y="21.33" width="32" height="10.66" fill="#1d4ed8" />
          </>
        )}
        {c === 'LU' && (
          <>
            <rect y="0" width="32" height="10.66" fill="#dc2626" />
            <rect y="10.66" width="32" height="10.66" fill="#ffffff" />
            <rect y="21.33" width="32" height="10.66" fill="#38bdf8" />
          </>
        )}
        {c === 'SE' && (
          <>
            <rect width="32" height="32" fill="#1d4ed8" />
            <rect x="10" y="0" width="5" height="32" fill="#facc15" />
            <rect x="0" y="13.5" width="32" height="5" fill="#facc15" />
          </>
        )}
        {c === 'DK' && (
          <>
            <rect width="32" height="32" fill="#dc2626" />
            <rect x="10" y="0" width="5" height="32" fill="#ffffff" />
            <rect x="0" y="13.5" width="32" height="5" fill="#ffffff" />
          </>
        )}
        {c === 'FI' && (
          <>
            <rect width="32" height="32" fill="#ffffff" />
            <rect x="10" y="0" width="5" height="32" fill="#1d4ed8" />
            <rect x="0" y="13.5" width="32" height="5" fill="#1d4ed8" />
          </>
        )}
      </g>
    </svg>
  );
}

export function SignalPingIcon({ ping, className = '' }: { ping: number; className?: string }) {
  const color = ping < 30 ? 'text-emerald-400' : ping < 50 ? 'text-green-400' : 'text-amber-400';
  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${color} ${className}`}>
      <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" className="shrink-0">
        <rect x="1" y="8" width="2.5" height="4" rx="0.75" />
        <rect x="5.5" y="4" width="2.5" height="8" rx="0.75" />
        <rect x="10" y="1" width="2.5" height="11" rx="0.75" />
      </svg>
      <span>{ping}</span>
    </div>
  );
}

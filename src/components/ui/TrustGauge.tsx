'use client';

import React, { useEffect, useState } from 'react';

interface TrustGaugeProps {
  value: number; // 0 - 100
  size?: number; // diameter in px
  strokeWidth?: number; // stroke width in px
  className?: string;
  showGlow?: boolean;
}

function interpolateRgb(c1: [number, number, number], c2: [number, number, number], factor: number): string {
  const f = Math.min(1, Math.max(0, factor));
  const r = Math.round(c1[0] + f * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + f * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + f * (c2[2] - c1[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Calculates colors for the gauge.
 * At 100% -> completely green.
 * As percentage decreases, the color shifts from green to yellow, orange, and red.
 */
function getTrustColors(percentage: number) {
  const p = Math.min(100, Math.max(0, percentage));

  let strokeStart: string;
  let strokeEnd: string;
  let textColor: string;
  let glowColor: string;

  if (p >= 85) {
    // 85% - 100%: Pure Green / Emerald
    const f = (p - 85) / 15;
    strokeStart = interpolateRgb([132, 204, 22], [16, 185, 129], f);
    strokeEnd = interpolateRgb([163, 230, 53], [34, 197, 94], f);
    textColor = strokeStart;
    glowColor = 'rgba(16, 185, 129, 0.35)';
  } else if (p >= 65) {
    // 65% - 84%: Lime / Light Green
    const f = (p - 65) / 20;
    strokeStart = interpolateRgb([234, 179, 8], [132, 204, 22], f);
    strokeEnd = interpolateRgb([250, 204, 21], [163, 230, 53], f);
    textColor = strokeStart;
    glowColor = 'rgba(132, 204, 22, 0.35)';
  } else if (p >= 40) {
    // 40% - 64%: Yellow / Amber
    const f = (p - 40) / 25;
    strokeStart = interpolateRgb([249, 115, 22], [234, 179, 8], f);
    strokeEnd = interpolateRgb([251, 146, 60], [250, 204, 21], f);
    textColor = strokeStart;
    glowColor = 'rgba(234, 179, 8, 0.35)';
  } else if (p >= 20) {
    // 20% - 39%: Orange
    const f = (p - 20) / 20;
    strokeStart = interpolateRgb([239, 68, 68], [249, 115, 22], f);
    strokeEnd = interpolateRgb([244, 63, 94], [251, 146, 60], f);
    textColor = strokeStart;
    glowColor = 'rgba(249, 115, 22, 0.35)';
  } else {
    // 0% - 19%: Pure Red
    strokeStart = '#ef4444';
    strokeEnd = '#dc2626';
    textColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.35)';
  }

  return { strokeStart, strokeEnd, textColor, glowColor };
}

export function TrustGauge({
  value,
  size = 72,
  strokeWidth = 7,
  className = '',
  showGlow = true,
}: TrustGaugeProps) {
  const [mounted, setMounted] = useState(false);
  const clampedValue = Math.min(100, Math.max(0, value));

  useEffect(() => {
    // Trigger smooth animation on mount
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const currentProgress = mounted ? clampedValue : 0;
  const strokeDashoffset = circumference - (currentProgress / 100) * circumference;

  const { strokeStart, strokeEnd, textColor, glowColor } = getTrustColors(clampedValue);
  const gradientId = `trust-gauge-gradient-${size}-${Math.round(clampedValue)}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 overflow-visible"
        style={showGlow ? { filter: `drop-shadow(0 0 6px ${glowColor})` } : undefined}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={strokeStart} />
            <stop offset="100%" stopColor={strokeEnd} />
          </linearGradient>
        </defs>

        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f1f22"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress Arc whose color reflects the trust percentage */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Percentage Label Centered in Ring */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span
          className="font-mono font-black text-sm tracking-tight"
          style={{ color: textColor }}
        >
          {clampedValue}%
        </span>
      </div>
    </div>
  );
}

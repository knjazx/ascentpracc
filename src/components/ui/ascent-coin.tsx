import React from 'react';
import Image from 'next/image';

interface AscentCoinProps {
  size?: number;
  className?: string;
  showText?: boolean;
  amount?: number | string;
}

export function AscentCoin({ size = 20, className = '', showText = false, amount }: AscentCoinProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle select-none ${className}`}>
      <span
        style={{ width: size, height: size }}
        className="relative shrink-0 rounded-full overflow-hidden inline-block"
      >
        <Image
          src="/ascent-coin.png"
          alt="ASCENT Coin"
          width={size}
          height={size}
          className="w-full h-full object-contain drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
          priority
        />
      </span>
      {amount !== undefined && (
        <span className="font-mono font-black text-white">{amount}</span>
      )}
      {showText && (
        <span className="font-mono font-bold text-amber-400 text-xs">ASCENT Coins</span>
      )}
    </span>
  );
}

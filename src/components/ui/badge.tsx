import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "cs" | "admin" | "live";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-white text-black font-bold shadow hover:bg-[#e5e5e5]",
    secondary: "border-[#222222] bg-[#111111] text-[#a1a1aa] hover:bg-[#1a1a1a] hover:border-white",
    destructive: "border-[#ef4444]/30 bg-[#ef4444]/15 text-[#ef4444] font-semibold",
    outline: "text-[#a1a1aa] border-[#222222] bg-transparent",
    cs: "bg-white text-black border border-white uppercase font-mono tracking-wider font-bold",
    admin: "bg-white text-black border border-white uppercase font-mono tracking-wider font-extrabold",
    live: "bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 font-mono font-bold animate-pulse",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };

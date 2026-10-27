import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "cs" | "admin" | "live";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-white text-black font-bold shadow hover:bg-neutral-200",
    secondary: "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800",
    destructive: "border-neutral-700 bg-neutral-900 text-neutral-200 shadow hover:bg-neutral-800",
    outline: "text-neutral-200 border-neutral-700 bg-transparent",
    cs: "bg-white/10 text-white border border-white/20 uppercase font-mono tracking-wider font-bold",
    admin: "bg-white text-black border border-white uppercase font-mono tracking-wider font-extrabold",
    live: "bg-white text-black border border-white font-mono font-bold animate-pulse",
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

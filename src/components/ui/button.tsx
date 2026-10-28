import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "cs"
    | "steam";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]";

    const variantStyles = {
      default:
        "bg-white text-black font-semibold hover:bg-[#e5e5e5] transition-colors",
      destructive:
        "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/25 transition-all font-semibold",
      outline:
        "border border-[#222222] bg-transparent shadow-sm hover:bg-[#1a1a1a] hover:border-white text-white transition-all",
      secondary:
        "bg-[#1a1a1a] text-white hover:bg-[#222222] border border-[#222222] shadow-sm transition-all",
      ghost:
        "hover:bg-[#1a1a1a] hover:text-white text-[#a1a1aa] transition-all",
      link: "text-white underline-offset-4 hover:underline",
      cs: "bg-white text-black font-bold uppercase tracking-wider shadow-sm hover:bg-[#e5e5e5] border border-white transition-all",
      steam:
        "bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#222222] shadow-sm hover:border-white transition-all",
    };

    const sizeStyles = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-11 rounded-md px-8 text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };

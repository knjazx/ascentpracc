import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "default" | "lg" | "xl";
}

export function Avatar({
  src,
  alt = "User Avatar",
  fallback = "CS",
  size = "default",
  className,
  ...props
}: AvatarProps) {
  const [hasError, setHasError] = React.useState(false);

  const sizeStyles = {
    sm: "h-7 w-7 text-xs",
    default: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-20 w-20 text-xl font-bold",
  };

  const pixelDimensions = {
    sm: 28,
    default: 36,
    lg: 48,
    xl: 80,
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border border-border bg-muted items-center justify-center font-medium uppercase text-muted-foreground select-none",
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {src && !hasError ? (
        <Image
          src={src}
          alt={alt}
          width={pixelDimensions[size]}
          height={pixelDimensions[size]}
          className="aspect-square h-full w-full object-cover"
          onError={() => setHasError(true)}
          unoptimized
        />
      ) : (
        <span>{fallback.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

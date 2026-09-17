import * as React from "react";

import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerDuration?: number;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  ({ className, children, shimmerColor = "color-mix(in oklab, white 70%, transparent)", shimmerDuration = 2, style, ...props }, ref) => (
    <button
      ref={ref}
      className={cn("relative inline-flex min-h-10 items-center justify-center overflow-hidden rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", className)}
      style={{ ...style, "--shimmer-color": shimmerColor, "--shimmer-duration": `${shimmerDuration}s` } as React.CSSProperties}
      {...props}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(110deg,transparent_20%,var(--shimmer-color)_45%,transparent_70%)]" />
      <span className="relative">{children}</span>
    </button>
  ),
);
ShimmerButton.displayName = "ShimmerButton";
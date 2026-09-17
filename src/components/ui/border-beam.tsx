import * as React from "react";

import { cn } from "@/lib/utils";

export interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  duration?: number;
  color?: string;
  reverse?: boolean;
}

export function BorderBeam({ className, size = 80, duration = 6, color = "var(--primary)", reverse = false, ...props }: BorderBeamProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      {...props}
    >
      <div
        className="absolute aspect-square rounded-full bg-[var(--border-beam-color)] blur-[1px] animate-border-beam"
        style={{
          "--border-beam-color": color,
          "--border-beam-size": `${size}px`,
          animationDirection: reverse ? "reverse" : "normal",
          animationDuration: `${duration}s`,
        } as React.CSSProperties}
      />
    </div>
  );
}
import * as React from "react";

import { cn } from "@/lib/utils";

export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: string;
  glowSize?: number;
}

export const MagicCard = React.forwardRef<HTMLDivElement, MagicCardProps>(
  ({ className, children, glowColor = "var(--primary)", glowSize = 240, onPointerMove, onPointerLeave, style, ...props }, ref) => {
    const [pointer, setPointer] = React.useState({ x: -glowSize, y: -glowSize });

    return (
      <div
        ref={ref}
        className={cn("group relative overflow-hidden rounded-xl border bg-card text-card-foreground", className)}
        onPointerLeave={(event) => {
          setPointer({ x: -glowSize, y: -glowSize });
          onPointerLeave?.(event);
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setPointer({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
          onPointerMove?.(event);
        }}
        style={{
          ...style,
          backgroundImage: `radial-gradient(${glowSize}px circle at ${pointer.x}px ${pointer.y}px, color-mix(in oklab, ${glowColor} 18%, transparent), transparent 72%)`,
        }}
        {...props}
      >
        <div className="relative h-full bg-card/90">{children}</div>
      </div>
    );
  },
);
MagicCard.displayName = "MagicCard";
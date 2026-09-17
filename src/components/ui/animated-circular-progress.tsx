import * as React from "react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

export interface AnimatedCircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => React.ReactNode;
}

export function AnimatedCircularProgress({
  className,
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  color = "var(--primary)",
  showValue = true,
  valueFormatter = (currentValue) => `${Math.round(currentValue)}%`,
  ...props
}: AnimatedCircularProgressProps) {
  const reducedMotion = useReducedMotion();
  const normalizedValue = Math.min(Math.max(value, 0), max);
  const progress = max > 0 ? (normalizedValue / max) * 100 : 0;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <div
      aria-label={`Progress: ${valueFormatter(normalizedValue)}`}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      className={cn("relative inline-grid place-items-center", className)}
      role="progressbar"
      style={{ width: size, height: size }}
      {...props}
    >
      <svg aria-hidden="true" className="-rotate-90" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={center} cy={center} fill="none" r={radius} stroke="currentColor" strokeOpacity="0.12" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          fill="none"
          pathLength="100"
          r={radius}
          stroke={color}
          strokeDasharray={`${progress} 100`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={reducedMotion ? undefined : { transition: "stroke-dasharray 700ms ease" }}
        />
      </svg>
      {showValue && <span className="absolute text-sm font-semibold tabular-nums">{valueFormatter(normalizedValue)}</span>}
    </div>
  );
}
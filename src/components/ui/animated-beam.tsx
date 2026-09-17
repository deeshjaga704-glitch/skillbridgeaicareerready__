import * as React from "react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

type BeamPoint = { x: number; y: number };

export interface AnimatedBeamProps extends React.SVGAttributes<SVGSVGElement> {
  containerRef: React.RefObject<HTMLElement | null>;
  fromRef: React.RefObject<HTMLElement | null>;
  toRef: React.RefObject<HTMLElement | null>;
  curvature?: number;
  pathColor?: string;
  pathWidth?: number;
  duration?: number;
  reverse?: boolean;
}

function getPoint(element: HTMLElement, container: HTMLElement): BeamPoint {
  const elementBounds = element.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  return {
    x: elementBounds.left - containerBounds.left + elementBounds.width / 2,
    y: elementBounds.top - containerBounds.top + elementBounds.height / 2,
  };
}

export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  pathColor = "currentColor",
  pathWidth = 2,
  duration = 3,
  reverse = false,
  ...props
}: AnimatedBeamProps) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [points, setPoints] = React.useState<{ from: BeamPoint; to: BeamPoint } | null>(null);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    const container = containerRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    if (!container || !from || !to) return;

    const updateBeam = () => {
      const bounds = container.getBoundingClientRect();
      setSize({ width: bounds.width, height: bounds.height });
      setPoints({ from: getPoint(from, container), to: getPoint(to, container) });
    };

    updateBeam();
    const observer = new ResizeObserver(updateBeam);
    observer.observe(container);
    observer.observe(from);
    observer.observe(to);
    window.addEventListener("resize", updateBeam);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBeam);
    };
  }, [containerRef, fromRef, toRef]);

  const path = points
    ? `M ${points.from.x},${points.from.y} C ${points.from.x + curvature},${points.from.y} ${points.to.x - curvature},${points.to.y} ${points.to.x},${points.to.y}`
    : "";

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-visible", className)}
      fill="none"
      height={size.height}
      preserveAspectRatio="none"
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={size.width}
      {...props}
    >
      {path && (
        <path
          className={cn(!reducedMotion && "animate-beam-dash")}
          d={path}
          pathLength="1"
          stroke={pathColor}
          strokeDasharray={reducedMotion ? undefined : "0.12 0.88"}
          strokeLinecap="round"
          strokeOpacity={reducedMotion ? 0.45 : 0.8}
          strokeWidth={pathWidth}
          style={{ animationDirection: reverse ? "reverse" : "normal", animationDuration: `${duration}s` }}
        />
      )}
    </svg>
  );
}
import * as React from "react";

import { useReducedMotion } from "./use-reduced-motion";

export interface NumberTickerProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  duration?: number;
  decimalPlaces?: number;
  format?: (value: number) => React.ReactNode;
}

export function NumberTicker({ value, duration = 1000, decimalPlaces = 0, format, ...props }: NumberTickerProps) {
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = React.useState(reducedMotion ? value : 0);
  const previousValue = React.useRef(displayValue);

  React.useEffect(() => {
    if (reducedMotion) {
      previousValue.current = value;
      setDisplayValue(value);
      return;
    }

    const startValue = previousValue.current;
    const startTime = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      const nextValue = startValue + (value - startValue) * easedProgress;
      setDisplayValue(nextValue);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else previousValue.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reducedMotion, value]);

  const roundedValue = Number(displayValue.toFixed(decimalPlaces));
  const output = format ? format(roundedValue) : roundedValue.toLocaleString(undefined, { maximumFractionDigits: decimalPlaces });
  return <span aria-label={String(output)} {...props}>{output}</span>;
}
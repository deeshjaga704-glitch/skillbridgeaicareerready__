import * as React from "react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

export interface TypingAnimationProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  duration?: number;
  startOnView?: boolean;
  showCursor?: boolean;
}

export function TypingAnimation({ text, duration = 80, startOnView = false, showCursor = true, className, ...props }: TypingAnimationProps) {
  const reducedMotion = useReducedMotion();
  const [visibleText, setVisibleText] = React.useState(reducedMotion ? text : startOnView ? "" : text);
  const [started, setStarted] = React.useState(!startOnView);
  const elementRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!startOnView || started || !elementRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setStarted(true);
    });
    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [startOnView, started]);

  React.useEffect(() => {
    if (reducedMotion || !started) {
      setVisibleText(text);
      return;
    }
    setVisibleText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, duration);
    return () => window.clearInterval(timer);
  }, [duration, reducedMotion, started, text]);

  return <span ref={elementRef} className={cn(showCursor && "after:ml-0.5 after:inline-block after:h-[1em] after:w-px after:animate-pulse after:bg-current after:align-[-0.15em]", className)} {...props}>{visibleText}</span>;
}
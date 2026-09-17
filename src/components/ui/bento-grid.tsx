import * as React from "react";

import { cn } from "@/lib/utils";

export function BentoGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid auto-rows-[minmax(12rem,auto)] grid-cols-1 gap-4 md:grid-cols-3", className)} {...props} />;
}

export function BentoGridItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("group relative overflow-hidden rounded-xl border bg-card p-6", className)} {...props} />;
}
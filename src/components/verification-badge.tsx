import { ShieldCheck, Github, GraduationCap, Mic, Terminal, Award } from "lucide-react";
import type { VerificationMethod } from "@/lib/skillbridge-store";
import { cn } from "@/lib/utils";

const META: Record<VerificationMethod, { label: string; icon: React.ComponentType<{ className?: string }>; strong: boolean }> = {
  "in-platform-project": { label: "Verified in-platform", icon: ShieldCheck, strong: true },
  "live-coding": { label: "Verified in-platform", icon: Terminal, strong: true },
  "oral-walkthrough": { label: "Verified in-platform", icon: Mic, strong: true },
  "instructor-signoff": { label: "Instructor signed off", icon: GraduationCap, strong: true },
  "github-repo": { label: "Verified via GitHub", icon: Github, strong: false },
  certificate: { label: "Certificate verified", icon: Award, strong: false },
};

export function VerificationBadge({ method, className }: { method: VerificationMethod; className?: string }) {
  const m = META[method];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        m.strong
          ? "bg-primary text-primary-foreground"
          : "bg-primary-soft text-primary ring-1 ring-primary/20",
        className,
      )}
      title={m.strong ? "Higher-weight signal" : "Lighter-weight signal"}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

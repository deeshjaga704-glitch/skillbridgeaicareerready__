import { CheckCircle2, Circle, Loader2, AlertTriangle } from "lucide-react";
import { SKILL_STATE_META, type SkillState } from "@/lib/skillbridge-evidence";
import { cn } from "@/lib/utils";

const ICONS: Record<SkillState, React.ComponentType<{ className?: string }>> = {
  verified: CheckCircle2,
  "in-review": Loader2,
  "needs-evidence": AlertTriangle,
  claimed: Circle,
};

export function SkillStatusBadge({
  state,
  className,
  showHint = false,
}: {
  state: SkillState;
  className?: string;
  showHint?: boolean;
}) {
  const meta = SKILL_STATE_META[state];
  const Icon = ICONS[state];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        meta.chip,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", state === "in-review" && "animate-spin")} />
      {meta.label}
      {showHint && <span className="font-normal opacity-80">· {meta.hint}</span>}
    </span>
  );
}

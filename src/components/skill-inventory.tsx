import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillStatusBadge } from "@/components/skill-status-badge";
import { skillState } from "@/lib/skillbridge-evidence";
import type { Skill } from "@/lib/skillbridge-store";

const SOURCE_LABEL: Record<Skill["source"], string> = {
  resume: "Resume",
  manual: "Self-reported",
  project: "Project evidence",
};

function Row({ skill }: { skill: Skill }) {
  const state = skillState(skill);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
      <span className="font-medium">{skill.name}</span>
      <SkillStatusBadge state={state} />
      <span className="text-xs text-muted-foreground">
        Source: {SOURCE_LABEL[skill.source]}
        {skill.category ? ` · ${skill.category}` : ""}
        {skill.extractedAt ? ` · added ${new Date(skill.extractedAt).toLocaleDateString()}` : ""}
      </span>
      <div className="ml-auto">
        {state === "verified" ? (
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/evidence">View evidence</Link>
          </Button>
        ) : (
          <Button asChild size="sm" className="rounded-full">
            <Link to="/verify" search={{ skill: skill.name }}>
              Verify this skill
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

export function SkillInventory({ skills }: { skills: Skill[] }) {
  const verified = skills.filter((s) => skillState(s) === "verified");
  const rest = skills.filter((s) => skillState(s) !== "verified");
  const pct = skills.length ? Math.round((verified.length / skills.length) * 100) : 0;

  return (
    <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight">Skill inventory</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          {verified.length} of {skills.length} skills verified
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full gradient-brand transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Claimed means you told us. Verified means evidence proved it.
      </p>

      {!!verified.length && (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Verified skills
          </p>
          <ul className="mt-2 space-y-2">
            {verified.map((s) => (
              <Row key={s.id} skill={s} />
            ))}
          </ul>
        </>
      )}

      {!!rest.length && (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Claimed skills — not proven yet
          </p>
          <ul className="mt-2 space-y-2">
            {rest.map((s) => (
              <Row key={s.id} skill={s} />
            ))}
          </ul>
        </>
      )}

      {!skills.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          No skills yet — upload your resume to get started.
        </p>
      )}
    </section>
  );
}

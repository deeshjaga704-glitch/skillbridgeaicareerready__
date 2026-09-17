import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, BookOpen, Hammer, Dumbbell, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getSkills, getStudent, type Skill, type Student } from "@/lib/skillbridge-store";
import { requirementsForRole, type Requirement } from "@/lib/skillbridge-roles";
import { VerificationBadge } from "@/components/verification-badge";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill gap — SkillBridge AI" },
      {
        name: "description",
        content:
          "See exactly which skills your target role expects, what you've already verified, and what to work on next.",
      },
      { property: "og:title", content: "Skill gap — SkillBridge AI" },
      {
        property: "og:description",
        content: "Compare your verified skills against what your target role actually asks for.",
      },
    ],
  }),
  component: SkillGapPage,
});

const KIND_ICON = { course: BookOpen, project: Hammer, practice: Dumbbell } as const;

function matchStatus(req: Requirement, skills: Skill[]) {
  const found = skills.find((s) => s.name.toLowerCase() === req.skill.toLowerCase());
  if (!found) return { state: "missing" as const, skill: undefined };
  return { state: found.status === "verified" ? ("verified" as const) : ("claimed" as const), skill: found };
}

function SkillGapPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    setSkills(getSkills());
    setStudent(getStudent());
  }, []);

  const reqs = requirementsForRole(student?.targetRole);
  const rows = reqs.map((r) => ({ req: r, ...matchStatus(r, skills) }));
  const verifiedCount = rows.filter((r) => r.state === "verified").length;
  const pct = reqs.length ? Math.round((verifiedCount / reqs.length) * 100) : 0;
  const missing = rows.filter((r) => r.state !== "verified");

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Your skill gap</h1>
          <p className="max-w-2xl text-muted-foreground">
            This is what <span className="font-medium text-foreground">{student?.targetRole || "your target role"}</span>{" "}
            postings usually ask for, checked against what you've actually verified. Claimed skills count for
            something — they just don't count as proof yet.
          </p>
        </header>

        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Verified coverage</p>
              <p className="font-display text-3xl font-bold">
                {verifiedCount}
                <span className="text-muted-foreground">/{reqs.length} skills</span>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              You're roughly {pct}% of the way there — nice progress.
            </p>
          </div>
          <Progress value={pct} className="mt-4 h-2" />
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Requirement by requirement</h2>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {rows.map(({ req, state, skill }) => (
              <div
                key={req.skill}
                className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-4 last:border-0"
              >
                {state === "verified" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/60" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{req.skill}</span>
                    <Badge variant={req.importance === "core" ? "secondary" : "outline"} className="rounded-full">
                      {req.importance === "core" ? "Core" : "Helpful"}
                    </Badge>
                    {skill?.status === "verified" && skill.verificationMethod ? (
                      <VerificationBadge method={skill.verificationMethod} />
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {skill ? "Claimed — not verified yet" : "Not on your profile"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{req.why}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">What to work on next</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {missing.map(({ req, state }) => (
              <div key={req.skill} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">{req.skill}</h3>
                  <span className="text-xs text-muted-foreground">
                    {state === "claimed" ? "Claimed — needs proof" : "Not started"}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {req.resources.map((r) => {
                    const Icon = KIND_ICON[r.kind];
                    return (
                      <li key={r.label} className="flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 text-primary" />
                        <span>{r.label}</span>
                      </li>
                    );
                  })}
                </ul>
                <Button asChild variant="secondary" size="sm" className="mt-4 rounded-full">
                  <Link to="/projects">
                    Verify with a proof project <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
            {missing.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Everything on the list is verified. Time to look at job matches.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

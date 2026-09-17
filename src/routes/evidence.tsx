import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, ExternalLink, FlaskConical, FileText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PROJECT_EVIDENCE } from "@/lib/skillbridge-evidence";

export const Route = createFileRoute("/evidence")({
  head: () => ({
    meta: [
      { title: "Project evidence — SkillBridge AI" },
      {
        name: "description",
        content: "Every proof project as an evidence record: technologies, verified skills, tests, docs, and readiness impact.",
      },
      { property: "og:title", content: "Project evidence — SkillBridge AI" },
      { property: "og:description", content: "See exactly what each project proves." },
    ],
  }),
  component: EvidencePage,
});

function EvidencePage() {
  const totalImpact = PROJECT_EVIDENCE.reduce((a, p) => a + p.readinessImpact, 0);
  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Project evidence</h1>
          <p className="max-w-2xl text-muted-foreground">
            Each project is an evidence record. It shows what it proves, how it was assessed, and how much it
            moved your readiness score — together worth{" "}
            <span className="font-semibold text-foreground">+{totalImpact} points</span>.
          </p>
        </header>

        <div className="grid gap-4">
          {PROJECT_EVIDENCE.map((p) => (
            <article key={p.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold">{p.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{p.difficulty}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <TrendingUp className="h-3 w-3" /> +{p.readinessImpact} readiness
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(p.completedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <Row label="Proves these skills">
                    <div className="flex flex-wrap gap-1.5">
                      {p.skills.map((s) => (
                        <span key={s} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                          {s}
                        </span>
                      ))}
                    </div>
                  </Row>
                  <Row label="Technologies">
                    <span className="text-sm text-muted-foreground">{p.technologies.join(" · ")}</span>
                  </Row>
                  <Row label="Tests">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <FlaskConical className="h-3.5 w-3.5 text-primary" />
                      {p.tests.passing}/{p.tests.count} passing
                    </span>
                  </Row>
                  <Row label="Documentation">
                    <span className="inline-flex items-center gap-1 text-sm capitalize">
                      <FileText className="h-3.5 w-3.5 text-primary" /> {p.documentation}
                    </span>
                  </Row>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a href={p.githubUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="rounded-full">
                        <Github className="mr-1 h-3.5 w-3.5" /> Repository
                      </Button>
                    </a>
                    {p.demoUrl && (
                      <a href={p.demoUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="rounded-full">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Live demo
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assessment results
                  </div>
                  <ul className="mt-3 space-y-3">
                    {p.assessment.map((a) => (
                      <li key={a.dimension}>
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>{a.dimension}</span>
                          <span className="tabular-nums">{a.score}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full gradient-brand" style={{ width: `${a.score}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary-soft/40 p-5">
          <p className="text-sm">Add another project and watch your readiness range move.</p>
          <Link to="/verify" search={{ skill: undefined }}>
            <Button className="rounded-full">Verify a new skill</Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

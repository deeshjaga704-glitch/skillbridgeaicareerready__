import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ShieldCheck, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CANDIDATES } from "@/lib/skillbridge-candidates";

export const Route = createFileRoute("/employers/")({
  head: () => ({
    meta: [
      { title: "Hire on evidence — SkillBridge AI for employers" },
      {
        name: "description",
        content: "Search students by verified skills, role readiness, and real projects — every claim links to proof.",
      },
      { property: "og:title", content: "Hire on evidence — SkillBridge AI for employers" },
      { property: "og:description", content: "Filter candidates by verified skills and open the evidence behind each one." },
    ],
    links: [{ rel: "canonical", href: "https://skillbridgeaicareerready.lovable.app/employers" }],
  }),
  component: EmployersPage,
});

function EmployersPage() {
  const [q, setQ] = useState("");
  const [minReady, setMinReady] = useState(0);
  const list = CANDIDATES.filter(
    (c) =>
      c.readinessLow >= minReady &&
      (q.trim() === "" ||
        c.verifiedSkills.some((s) => s.name.toLowerCase().includes(q.toLowerCase())) ||
        c.targetRole.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
          <Link to="/" className="font-display font-bold">
            SkillBridge <span className="text-primary">AI</span>
          </Link>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
            Employers
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold">Candidates you can verify</h1>
          <p className="max-w-2xl text-muted-foreground">
            Search by verified skill or role. Every readiness range opens into the projects, tests, and assessments
            behind it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Verified skill or role (e.g. Python, backend)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Min readiness</span>
            <input
              type="range"
              min={0}
              max={90}
              step={10}
              value={minReady}
              onChange={(e) => setMinReady(Number(e.target.value))}
            />
            <span className="w-10 tabular-nums font-medium">{minReady}%</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <article key={c.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold">{c.name}</h2>
                <span className="text-sm text-muted-foreground">{c.targetRole}</span>
                <span className="ml-auto font-display text-lg font-extrabold tabular-nums">
                  {c.readinessLow}–{c.readinessHigh}%
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.year} · {c.evidenceCount} evidence items · {c.projects.length} projects
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.verifiedSkills.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                  >
                    <ShieldCheck className="h-3 w-3" /> {s.name} · {s.level}
                  </span>
                ))}
              </div>
              <Link to="/employers/$id" params={{ id: c.id }}>
                <Button size="sm" className="mt-4 rounded-full">
                  View evidence profile <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </article>
          ))}
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">No candidates match those filters yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}

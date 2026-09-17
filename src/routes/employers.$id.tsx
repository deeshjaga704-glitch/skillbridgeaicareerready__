import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ShieldCheck, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCandidate } from "@/lib/skillbridge-candidates";

export const Route = createFileRoute("/employers/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Candidate evidence profile — SkillBridge AI" },
      {
        name: "description",
        content: "Verified skills, projects, assessments, and direct links to proof for one candidate.",
      },
      { property: "og:title", content: "Candidate evidence profile — SkillBridge AI" },
      { property: "og:description", content: "Validate a candidate on evidence, not resume claims." },
      { property: "og:type", content: "profile" },
    ],
    links: [{ rel: "canonical", href: `https://skillbridgeaicareerready.lovable.app/employers/${params.id}` }],
  }),
  component: CandidateProfile,
});

function CandidateProfile() {
  const { id } = useParams({ from: "/employers/$id" });
  const c = getCandidate(id);

  if (!c) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Candidate not found</h1>
        <Link to="/employers" className="mt-4 inline-block text-primary underline">Back to search</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-5">
          <Link to="/employers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All candidates
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <section className="rounded-3xl border border-border bg-gradient-to-br from-primary-soft via-card to-teal-soft p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{c.name}</h1>
            <span className="text-muted-foreground">{c.targetRole} · {c.year}</span>
            <span className="ml-auto font-display text-3xl font-extrabold tabular-nums">
              {c.readinessLow}–{c.readinessHigh}%
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Readiness shown as a range, backed by {c.evidenceCount} evidence items across {c.projects.length} projects.
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Verified skills</h2>
          <ul className="mt-3 space-y-2">
            {c.verifiedSkills.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-success" />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">{s.level} · confidence {s.confidence}</span>
                {s.token && (
                  <Link to="/report/$token" params={{ token: s.token }} className="ml-auto text-xs text-primary underline">
                    Open evidence report
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {c.claimedSkills.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Claimed but not verified: {c.claimedSkills.join(", ")}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Projects</h2>
          <ul className="mt-3 space-y-2">
            {c.projects.map((p) => (
              <li key={p.title} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                <span className="font-medium">{p.title}</span>
                <span className="text-muted-foreground">{p.tests} · proves {p.proves.join(", ")}</span>
                <a href={p.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-primary underline">
                  Repository <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Assessment scores</h2>
          <ul className="mt-3 space-y-3">
            {c.assessments.map((a) => (
              <li key={a.dimension}>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{a.dimension}</span>
                  <span className="tabular-nums">{a.score}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full gradient-brand" style={{ width: `${a.score}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-5 rounded-full" disabled>
            Contact candidate (prototype)
          </Button>
        </section>
      </main>
    </div>
  );
}

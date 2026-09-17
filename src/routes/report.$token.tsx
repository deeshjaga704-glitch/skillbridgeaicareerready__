import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Share2, Github, ExternalLink, CheckCircle2, Sparkles, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getRecordByToken,
  getSkills,
  type Skill,
  type VerificationRecord,
} from "@/lib/skillbridge-store";
import { SkillStatusBadge } from "@/components/skill-status-badge";
import { buildReport, freshnessLabel, type EvidenceReport } from "@/lib/skillbridge-evidence";
import { getAuthenticatedVerificationRecordByToken } from "@/lib/supabase/profile";

export const Route = createFileRoute("/report/$token")({
  head: ({ params }) => ({
    meta: [
      { title: `Evidence report — SkillBridge AI` },
      {
        name: "description",
        content: "An evidence report showing the projects, tests, and assessments behind one verified skill.",
      },
      { property: "og:title", content: "Evidence report — SkillBridge AI" },
      { property: "og:description", content: "Verified skill evidence: projects, assessments, and capabilities." },
      { property: "og:type", content: "article" },
    ],
    links: [
      { rel: "canonical", href: `https://skillbridgeaicareerready.lovable.app/report/${params.token}` },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { token } = useParams({ from: "/report/$token" });
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const [report, setReport] = useState<EvidenceReport | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      const supabaseRecord = await getAuthenticatedVerificationRecordByToken(token).catch(() => null);
      const rec = supabaseRecord ?? getRecordByToken(token);
      if (cancelled) return;

      setRecord(rec);
      if (rec) {
        const skill: Skill =
          getSkills().find((s) => s.id === rec.skillId) ??
          ({
            id: rec.skillId,
            name: rec.skillName,
            status: rec.outcome === "verified" ? "verified" : "needs-evidence",
            source: "project",
            lastVerifiedAt: rec.outcome === "verified" ? rec.timestamp : undefined,
            confidenceLow: 70,
            confidenceHigh: 83,
          } as Skill);
        setReport(buildReport(skill));
      }
      setReady(true);
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!ready) return null;

  if (!record || !report) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Report not found</h1>
        <p className="mt-2 text-muted-foreground">This evidence link may have been revoked.</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">Go home</Link>
      </div>
    );
  }

  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Evidence report link copied");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display font-bold">SkillBridge <span className="text-primary">AI</span></span>
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">Public evidence report</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary-soft via-card to-teal-soft p-8">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-bold">{record.skillName}</h1>
            <SkillStatusBadge state={report.state} />
            <Button size="sm" variant="outline" className="ml-auto rounded-full" onClick={share}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> Share this evidence report
            </Button>
          </div>
          <p className="mt-2 text-muted-foreground">
            {record.studentName} · verified {freshnessLabel(record.timestamp)} (
            {new Date(record.timestamp).toLocaleDateString()})
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              { k: "Skill level", v: report.level },
              {
                k: "Confidence",
                v: `${report.skill.confidenceLow ?? 70}–${report.skill.confidenceHigh ?? 83}%`,
              },
              { k: "Projects", v: String(report.projects.length) },
              { k: "Checks run", v: String(record.signals.length) },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.k}</div>
                <div className="font-semibold">{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <FlaskConical className="h-4 w-4 text-primary" /> Assessment dimensions
          </h2>
          <ul className="mt-4 space-y-3">
            {record.signals.map((s) => (
              <li key={s.type} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{s.label}</span>
                  <span
                    className={
                      s.outcome === "pass"
                        ? "rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                        : "rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                    }
                  >
                    {s.outcome}
                  </span>
                  <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                    strength {Math.round(s.strength * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Capabilities demonstrated</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {report.capabilities.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> {c}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Evidence</h2>
          <p className="text-sm text-muted-foreground">{record.evidenceSummary}</p>
          <ul className="mt-4 space-y-2">
            {report.projects.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{p.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{p.difficulty}</span>
                  <a
                    href={p.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-primary underline"
                  >
                    Open repo <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.tests.passing}/{p.tests.count} tests passing · {p.documentation} docs ·{" "}
                  {p.technologies.join(", ")}
                </p>
              </li>
            ))}
            {report.projects.length === 0 && (
              <li className="text-sm text-muted-foreground">Evidence stored in-platform.</li>
            )}
          </ul>
        </section>

        <p className="pb-10 text-center text-xs text-muted-foreground">
          Why this result: {record.reason}
        </p>
      </main>
    </div>
  );
}

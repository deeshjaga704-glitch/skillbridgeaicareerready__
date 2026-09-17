import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  XCircle,
  Loader2,
  Github,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  ScrollText,
  ExternalLink,
  Info,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getRecords,
  getSkills,
  saveSkills,
  upsertRecord,
  pushActivity,
  type VerificationRecord,
  type VerificationSignal,
  type VerificationOutcome,
} from "@/lib/skillbridge-store";
import { VerificationBadge } from "@/components/verification-badge";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Proof project — SkillBridge AI" },
      { name: "description", content: "Submit a proof project and see every verification signal we check." },
    ],
  }),
  component: ProjectsPage,
});

type Stage = "idle" | "running" | "done";

const SIGNAL_PLAN: Array<Pick<VerificationSignal, "type" | "label"> & { detail: string; outcome: "pass" | "warn"; strength: number }> = [
  { type: "commit_pattern", label: "Commit pattern", detail: "Gradual commits over time, not a single dump", outcome: "pass", strength: 0.82 },
  { type: "originality_check", label: "Code originality", detail: "No matches against common tutorial repositories", outcome: "pass", strength: 0.86 },
  { type: "style_consistency", label: "Style consistency", detail: "Matches your other verified work", outcome: "pass", strength: 0.74 },
  { type: "graded_project", label: "Graded in-platform project", detail: "Not yet completed — upload rubric result to strengthen", outcome: "warn", strength: 0.3 },
];

function ProjectsPage() {
  const [skillName, setSkillName] = useState("React");
  const [repoUrl, setRepoUrl] = useState("https://github.com/alex/todo-app");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VerificationRecord | null>(null);

  const signals = useMemo(() => SIGNAL_PLAN.map((s) => ({ ...s })), []);

  useEffect(() => {
    if (stage !== "running") return;
    setProgress(0);
    let i = 0;
    const total = signals.length;
    const timer = setInterval(() => {
      i += 1;
      setProgress(i);
      if (i >= total) {
        clearInterval(timer);
        finalize();
      }
    }, 700);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const finalize = () => {
    const built: VerificationSignal[] = signals.map((s) => ({
      type: s.type,
      label: s.label,
      outcome: s.outcome,
      strength: s.strength,
      detail: s.detail,
    }));
    const avgStrength = built.reduce((sum, s) => sum + s.strength, 0) / built.length;
    const outcome: VerificationOutcome = avgStrength >= 0.7 ? "verified" : avgStrength >= 0.5 ? "partial" : "not_verified";
    const contribution =
      outcome === "verified"
        ? "This adds strong evidence"
        : outcome === "partial"
        ? "This adds moderate evidence"
        : "This adds weak evidence";
    const id = crypto.randomUUID();
    const rec: VerificationRecord = {
      id,
      token: id.slice(0, 8),
      skillId: `dyn-${id.slice(0, 6)}`,
      skillName,
      studentName: "Alex Rivera",
      method: "github-repo",
      evidenceSummary: `${repoUrl}${notes ? ` — ${notes}` : ""}`,
      outcome,
      signals: built,
      timestamp: new Date().toISOString(),
      reason: `${contribution} for ${skillName}. Weighted lighter than an in-platform graded project.`,
    };
    upsertRecord(rec);

    // Add/update the skill list.
    const skills = getSkills();
    const existing = skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
    if (outcome === "verified" || outcome === "partial") {
      if (existing) {
        existing.status = "verified";
        existing.lastVerifiedAt = rec.timestamp;
        existing.verificationMethod = "github-repo";
        existing.verificationRecordId = rec.id;
        existing.confidenceLow = Math.round(Math.max(0, avgStrength * 100 - 8));
        existing.confidenceHigh = Math.round(Math.min(100, avgStrength * 100 + 6));
      } else {
        skills.push({
          id: crypto.randomUUID(),
          name: skillName,
          status: "verified",
          source: "project",
          lastVerifiedAt: rec.timestamp,
          verificationMethod: "github-repo",
          verificationRecordId: rec.id,
          confidenceLow: Math.round(avgStrength * 100 - 8),
          confidenceHigh: Math.round(avgStrength * 100 + 6),
        });
      }
      saveSkills(skills);
    }
    pushActivity({
      reason: `Proof project reviewed — ${skillName}`,
      detail: `${signals.length} signals · outcome: ${outcome.replace("_", " ")}`,
    });
    setResult(rec);
    setStage("done");
    toast.success(`Verification complete — ${outcome.replace("_", " ")}`);
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Proof project
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            We evaluate multiple signals — not a single pass/fail — so a verified skill
            actually means something. In-platform work is weighted higher than
            found-in-the-wild GitHub repos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/verify-alt">
            <Button variant="outline" className="rounded-full">
              Other ways to verify <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <Github className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold">Submit for review</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="skill" className="text-xs">Skill</Label>
              <Input id="skill" value={skillName} onChange={(e) => setSkillName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="repo" className="text-xs">GitHub repo URL</Label>
              <Input id="repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notes" className="text-xs">Anything reviewers should know? (optional)</Label>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button
              className="w-full rounded-full"
              onClick={() => { setResult(null); setStage("running"); }}
              disabled={stage === "running"}
            >
              {stage === "running" ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Reviewing…</>
              ) : (
                <>Run verification <Sparkles className="ml-1 h-4 w-4" /></>
              )}
            </Button>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              GitHub-based verification is a lighter-weight signal than in-platform work. Consider pairing it with an oral walkthrough for a stronger record.
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-soft text-teal">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold">Signals being evaluated</h2>
          </div>

          <ul className="mt-4 space-y-2">
            {signals.map((s, i) => {
              const state: "pending" | "running" | "done" =
                stage === "idle"
                  ? "pending"
                  : stage === "done" || i < progress
                  ? "done"
                  : i === progress
                  ? "running"
                  : "pending";
              const outcome = s.outcome;
              return (
                <li
                  key={s.type}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  <span className="mt-0.5">
                    {state === "pending" && <Circle className="h-4 w-4 text-muted-foreground" />}
                    {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {state === "done" && outcome === "pass" && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {state === "done" && outcome === "warn" && <AlertCircle className="h-4 w-4 text-warning" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                  {state === "done" && (
                    <span
                      className={
                        outcome === "pass"
                          ? "rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"
                          : "rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground"
                      }
                    >
                      {outcome === "pass" ? "Pass" : "Needs more"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {result && (
            <div className="mt-6 rounded-2xl border border-border/60 bg-primary-soft/40 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <VerificationBadge method={result.method} />
                <span className="text-sm font-semibold">
                  {result.outcome === "verified"
                    ? "This adds strong evidence"
                    : result.outcome === "partial"
                    ? "This adds moderate evidence"
                    : "This adds weak evidence"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{result.reason}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/v/$token" params={{ token: result.token }}>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open verification record
                  </Button>
                </Link>
                {result.outcome !== "verified" && (
                  <Link
                    to="/appeals"
                    search={{ skillId: result.skillId, skillName: result.skillName, outcome: result.outcome }}
                  >
                    <Button variant="ghost" size="sm" className="rounded-full">
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Appeal this result
                    </Button>
                  </Link>
                )}
                <Link to="/dashboard">
                  <Button size="sm" className="rounded-full">
                    Back to dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-coral-soft text-coral">
            <ScrollText className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg font-bold">Recent verification records</h2>
        </div>
        <ul className="mt-4 divide-y divide-border/60">
          {getRecords().slice(0, 6).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <span className="font-medium">{r.skillName}</span>
              <VerificationBadge method={r.method} />
              <span className="text-xs text-muted-foreground">{new Date(r.timestamp).toLocaleDateString()}</span>
              <Link to="/v/$token" params={{ token: r.token }} className="ml-auto text-xs font-medium text-primary hover:underline">
                View record →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

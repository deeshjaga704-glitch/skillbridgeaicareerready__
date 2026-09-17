import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Github,
  Upload,
  Terminal,
  Mic,
  GraduationCap,
  ShieldCheck,
  FlaskConical,
  ScanSearch,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getStudent,
  saveSkills,
  upsertRecord,
  pushActivity,
  type Skill,
  type SignalType,
  type VerificationMethod,
  type VerificationRecord,
} from "@/lib/skillbridge-store";
import { SkillStatusBadge } from "@/components/skill-status-badge";
import { skillState, projectsForSkill } from "@/lib/skillbridge-evidence";
import {
  analyzeEvidence,
  type VerificationAnalysis,
  type CheckOutcome,
} from "@/lib/verification-analysis.functions";
import {
  getAuthenticatedSkillProgress,
  persistVerificationRecord,
  persistVerifiedSkillProgress,
} from "@/lib/supabase/profile";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a skill — SkillBridge AI" },
      {
        name: "description",
        content:
          "A step-by-step verification flow: pick a skill, attach a real repository, watch the tests, docs and quality checks run, get a report.",
      },
      { property: "og:title", content: "Verify a skill — SkillBridge AI" },
      { property: "og:description", content: "Real checks on real code — no black box." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ skill: typeof s.skill === "string" ? s.skill : undefined }),
  component: VerifyFlow,
});

const SOURCES: { id: VerificationMethod; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "github-repo", label: "GitHub repository", desc: "We read commits, tests, CI results, structure and README.", icon: Github },
  { id: "in-platform-project", label: "Upload a project", desc: "Link the repo of the project you submitted.", icon: Upload },
  { id: "live-coding", label: "Live-coding check", desc: "25-minute timed task, same weight as a repo.", icon: Terminal },
  { id: "oral-walkthrough", label: "Oral walkthrough", desc: "Explain your project out loud.", icon: Mic },
  { id: "instructor-signoff", label: "Instructor sign-off", desc: "Your lecturer confirms the work.", icon: GraduationCap },
];

const RUNNING_STEPS = [
  "Fetching the repository from GitHub",
  "Reading commit history",
  "Looking for tests and CI results",
  "Scoring documentation",
  "Reviewing code quality",
];

const STEPS = ["Skill", "Evidence source", "Attach", "Analysis", "Assessment", "Result"] as const;

const CHECK_ICON: Record<CheckOutcome, React.ReactNode> = {
  pass: <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />,
  warn: <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />,
  fail: <XCircle className="mt-0.5 h-4 w-4 text-destructive" />,
};

const OUTCOME_COPY = {
  verified: { title: "verified", state: "verified" as const, tone: "text-success" },
  partial: { title: "partly evidenced", state: "needs-evidence" as const, tone: "text-warning-foreground" },
  not_verified: { title: "not verified yet", state: "needs-evidence" as const, tone: "text-destructive" },
};

function VerifyFlow() {
  const { skill: presetSkill } = useSearch({ from: "/verify" });
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillId, setSkillId] = useState<string>("");
  const [source, setSource] = useState<VerificationMethod | "">("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VerificationAnalysis | null>(null);
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const run = useServerFn(analyzeEvidence);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSkills() {
      try {
        const loadedSkills = await getAuthenticatedSkillProgress();
        if (cancelled) return;

        setSkills(loadedSkills);
        if (presetSkill) {
          const found = loadedSkills.find((x) => x.name.toLowerCase() === presetSkill.toLowerCase());
          if (found) {
            setSkillId(found.id);
            setStep(1);
          } else {
            setError(`The skill "${presetSkill}" is not present in your Supabase skill progress.`);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "We couldn't load your skills.");
        }
      }
    }

    void loadSkills();
    return () => {
      cancelled = true;
    };
  }, [presetSkill]);

  const skill = skills.find((s) => s.id === skillId);

  const startAnalysis = async () => {
    if (!skill || !source || started.current) return;
    started.current = true;
    setError(null);
    setAnalysis(null);
    setTick(0);
    setStep(3);
    const timer = setInterval(() => setTick((t) => Math.min(t + 1, RUNNING_STEPS.length - 1)), 1400);
    try {
      const result = await run({
        data: { skillName: skill.name, method: source, evidenceUrl: url.trim() || undefined, notes: notes.trim() || undefined },
      });
      setAnalysis(result);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis could not be completed.");
      setStep(2);
    } finally {
      clearInterval(timer);
      started.current = false;
    }
  };

  const finish = async () => {
    if (!skill || !source || !analysis) return;
    const verified = analysis.outcome === "verified";

    try {
      if (verified) {
        await persistVerifiedSkillProgress(skill.name, analysis.analysedAt);
      }
    } catch (persistenceError) {
      setError(
        persistenceError instanceof Error
          ? persistenceError.message
          : "We couldn't save the verified skill to Supabase.",
      );
      return;
    }

    const student = getStudent();
    const token = `${skill.name.toLowerCase().replace(/[^a-z]/g, "")}-${Date.now().toString(36)}`;
    const rec: VerificationRecord = {
      id: crypto.randomUUID(),
      token,
      skillId: skill.id,
      skillName: skill.name,
      evidenceUrl: url.trim() || undefined,
      studentName: student?.name ?? "Alex Rivera",
      method: source,
      outcome: analysis.outcome,
      evidenceSummary: analysis.repo ? `${analysis.repo.fullName} — ${analysis.repo.commits} commits, ${analysis.repo.files} files` : url || "No inspectable evidence supplied",
      timestamp: analysis.analysedAt,
      reason: analysis.reason,
      signals: analysis.checks.map((c) => ({
        type: c.id as SignalType,
        label: c.label,
        outcome: c.outcome,
        strength: c.strength,
        detail: c.detail,
      })),
      analysis: {
        source: analysis.source,
        overall: analysis.overall,
        repo: analysis.repo as unknown as Record<string, unknown> | undefined,
        dimensions: analysis.dimensions,
        facts: Object.fromEntries(analysis.checks.map((c) => [c.label, c.facts])),
        warnings: analysis.warnings,
      },
    };

    try {
      await persistVerificationRecord(rec);
    } catch (persistenceError) {
      setError(
        persistenceError instanceof Error
          ? persistenceError.message
          : "We couldn't save the verification record to Supabase.",
      );
      setStep(2);
      return;
    }

    upsertRecord(rec);
    const next = skills.map((s) =>
      s.id === skill.id
        ? {
            ...s,
            status: (verified ? "verified" : "needs-evidence") as Skill["status"],
            source: "project" as const,
            lastVerifiedAt: verified ? rec.timestamp : s.lastVerifiedAt,
            confidenceLow: Math.max(0, analysis.overall - 7),
            confidenceHigh: Math.min(100, analysis.overall + 6),
            verificationMethod: source,
            verificationRecordId: rec.id,
          }
        : s,
    );
    saveSkills(next);
    setSkills(verified ? await getAuthenticatedSkillProgress() : next);
    pushActivity({
      reason: `${skill.name} ${verified ? "verified" : "analysed"}`,
      detail: `${analysis.checks.filter((c) => c.outcome === "pass").length}/${analysis.checks.length} checks passed`,
    });
    setRecord(rec);
    setStep(5);
    if (verified) toast.success(`${skill.name} is now verified`);
    else toast.warning(`${skill.name} needs stronger evidence`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Verify a skill</h1>
          <p className="text-muted-foreground">
            We read your actual repository — commits, tests, CI results, README and code — and show every check we ran.
          </p>
          {error && step === 0 && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          )}
        </header>

        {/* Stepper */}
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={
                i === step
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  : i < step
                  ? "rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success"
                  : "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="rounded-3xl border border-border bg-card p-6">
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold">Which skill are you proving?</h2>
              {skills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSkillId(s.id);
                    setStep(1);
                  }}
                  className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left hover:border-primary/40"
                >
                  <span className="font-medium">{s.name}</span>
                  <SkillStatusBadge state={skillState(s)} />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {projectsForSkill(s.name).length} project(s) on file
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold">How do you want to prove {skill?.name}?</h2>
              <p className="text-sm text-muted-foreground">
                Whichever you pick, link the public repository behind the work — that is what we can actually inspect.
              </p>
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSource(s.id);
                    setStep(2);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left hover:border-primary/40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.desc}</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold">Attach your evidence</h2>
              <Input
                placeholder="https://github.com/you/your-project"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Textarea
                placeholder="Optional: what did you build, and which parts did you write yourself?"
                value={notes}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                We read only the public repository you link. Without a repository we can't run any checks, and the skill
                stays a claim.
              </p>
              {error && (
                <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" className="rounded-full" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className="rounded-full" onClick={startAnalysis}>
                  Run the checks <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <ScanSearch className="h-5 w-5 text-primary" /> Analysing your evidence
              </h2>
              <ul className="space-y-2">
                {RUNNING_STEPS.map((label, i) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                  >
                    {i < tick ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                    ) : (
                      <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{label}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                This runs against the live repository, so it can take up to a minute.
              </p>
            </div>
          )}

          {step === 4 && analysis && (
            <div className="space-y-5">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                <FlaskConical className="h-5 w-5 text-primary" /> What we found
              </h2>

              {analysis.repo && (
                <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                  <a href={analysis.repo.url} target="_blank" rel="noreferrer" className="font-medium text-primary">
                    {analysis.repo.fullName}
                  </a>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {analysis.repo.commits} commits · {analysis.repo.files} files · {analysis.repo.testFiles.length} test
                    files · CI {analysis.repo.latestCiConclusion ?? "not run"} · {analysis.repo.language ?? "mixed"}
                  </div>
                </div>
              )}

              <ul className="space-y-2">
                {analysis.checks.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                    <div className="flex items-start gap-3">
                      {CHECK_ICON[c.outcome]}
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>{c.label}</span>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {Math.round(c.strength * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                        <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground/80">
                          {c.facts.map((f) => (
                            <li key={f}>· {f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {analysis.dimensions.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {analysis.dimensions.map((x) => (
                    <div key={x.dimension} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{x.dimension}</span>
                        <span className="tabular-nums">{x.score}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full gradient-brand" style={{ width: `${x.score}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{x.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {analysis.warnings.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {analysis.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warning" /> {w}
                    </li>
                  ))}
                </ul>
              )}

              <Button className="rounded-full" onClick={finish}>
                Save this to my evidence record <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 5 && record && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-6 w-6 ${OUTCOME_COPY[record.outcome].tone}`} />
                <h2 className="font-display text-xl font-bold">
                  {record.skillName} {OUTCOME_COPY[record.outcome].title}
                </h2>
                <SkillStatusBadge state={OUTCOME_COPY[record.outcome].state} />
              </div>
              <p className="text-sm text-muted-foreground">{record.reason}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { k: "Checks run", v: String(record.signals.length) },
                  { k: "Checks passed", v: String(record.signals.filter((s) => s.outcome === "pass").length) },
                  {
                    k: "Confidence",
                    v: `${Math.max(0, (record.analysis?.overall ?? 0) - 7)}–${Math.min(100, (record.analysis?.overall ?? 0) + 6)}%`,
                  },
                  { k: "Analysed on", v: new Date(record.timestamp).toLocaleDateString() },
                ].map((x) => (
                  <div key={x.k} className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.k}</div>
                    <div className="font-semibold">{x.v}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Checks written to your evidence record
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {record.signals.map((s) => (
                    <li key={s.type} className="flex items-start gap-2">
                      {CHECK_ICON[s.outcome as CheckOutcome] ?? <CheckCircle2 className="mt-0.5 h-4 w-4" />}
                      <span>
                        {s.label} — {s.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/report/$token" params={{ token: record.token }}>
                  <Button className="rounded-full">Open evidence report</Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="outline" className="rounded-full">Back to dashboard</Button>
                </Link>
                <Link to="/appeals">
                  <Button variant="ghost" className="rounded-full">Disagree with this result?</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

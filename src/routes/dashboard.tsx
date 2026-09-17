import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowRight,
  Target,
  Sparkles,
  TrendingUp,
  Activity,
  ChevronDown,
  Share2,
  Scale,
  Briefcase,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  computeReadiness,
  getActivity,
  getRecords,
  getStudent,
  getSmoothedScore,
  saveSmoothedScore,
  type ActivityItem,
  type Skill,
  type Student,
} from "@/lib/skillbridge-store";
import { SkillStatusBadge } from "@/components/skill-status-badge";
import { SkillInventory } from "@/components/skill-inventory";
import { LearningTaskList } from "@/components/learning-task-list";
import {
  PROJECT_EVIDENCE,
  rankedActions,
  roleReadiness,
  scoreFactors,
  skillLevel,
  skillState,
  freshnessLabel,
} from "@/lib/skillbridge-evidence";
import { getAuthenticatedProfile, getAuthenticatedSkillProgress } from "@/lib/supabase/profile";
import {
  completeAuthenticatedLearningTask,
  getAuthenticatedLearningTasks,
  type AuthenticatedLearningTasks,
} from "@/lib/supabase/learning-tasks";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — SkillBridge AI" },
      { name: "description", content: "Your verified readiness score, skill gaps, and the one next action that moves it most." },
      { property: "og:title", content: "Your dashboard — SkillBridge AI" },
      { property: "og:description", content: "Readiness, gaps, and your next best action — all traceable to evidence." },
    ],
  }),
  component: Dashboard,
});

function useSmoothedRange(target: { low: number; high: number }) {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    const prev = getSmoothedScore() ?? target;
    setDisplay(prev);
    let cur = { ...prev };
    const tick = () => {
      const dl = target.low - cur.low;
      const dh = target.high - cur.high;
      if (Math.abs(dl) < 0.5 && Math.abs(dh) < 0.5) {
        cur = { ...target };
        setDisplay(cur);
        saveSmoothedScore(cur);
        return;
      }
      cur = {
        low: cur.low + Math.sign(dl) * Math.min(Math.abs(dl) * 0.35, 3),
        high: cur.high + Math.sign(dh) * Math.min(Math.abs(dh) * 0.35, 3),
      };
      setDisplay({ low: cur.low, high: cur.high });
      raf = requestAnimationFrame(() => setTimeout(tick, 80));
    };
    let raf = requestAnimationFrame(() => setTimeout(tick, 120));
    return () => cancelAnimationFrame(raf);
  }, [target.low, target.high]);
  return { low: Math.round(display.low), high: Math.round(display.high) };
}

function Dashboard() {
  const navigate = useNavigate();
  const loadLearningTasks = useServerFn(getAuthenticatedLearningTasks);
  const completeLearningTask = useServerFn(completeAuthenticatedLearningTask);
  const [student, setStudent] = useState<Student | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [learningTasks, setLearningTasks] = useState<AuthenticatedLearningTasks | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openWhy, setOpenWhy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const { user, student: profileStudent } = await getAuthenticatedProfile();
        if (cancelled) return;

        const cachedStudent = getStudent();
        setStudent(
          profileStudent ??
            (cachedStudent
              ? { ...cachedStudent, email: user.email }
              : {
                  name: user.email ?? "Your profile",
                  email: user.email,
                  yearOfStudy: "",
                  targetRole: "Software Engineer",
                  createdAt: user.created_at,
                }),
        );
        setSkills(await getAuthenticatedSkillProgress());
        setActivity(getActivity());
        try {
          const taskData = await loadLearningTasks({ data: {} });
          if (!cancelled) {
            setLearningTasks(taskData);
            setTasksError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setTasksError(error instanceof Error ? error.message : "We couldn't load your learning tasks.");
          }
        }
        setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "We couldn't load your account data.");
        }
      } finally {
        if (!cancelled) setReady(true);
        if (!cancelled) setTasksLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      const completedTask = await completeLearningTask({ data: { taskId } });
      if (!completedTask) throw new Error("That learning task is no longer available.");
      setLearningTasks((current) => current ? {
        active: current.active.filter((task) => task.id !== taskId),
        completed: [completedTask, ...current.completed.filter((task) => task.id !== taskId)],
      } : current);
      toast.success("Learning task completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't complete that learning task.");
    } finally {
      setCompletingTaskId(null);
    }
  };

  const role = student?.targetRole;
  const factors = useMemo(() => scoreFactors(skills, role), [skills, role]);
  const readinessFactors = useMemo(
    () => factors.map(({ value, max }) => ({ value, max })),
    [factors],
  );
  const readiness = useMemo(
    () => computeReadiness(skills, readinessFactors),
    [skills, readinessFactors],
  );
  const smoothed = useSmoothedRange({ low: readiness.low, high: readiness.high });
  const roleFit = useMemo(() => roleReadiness(skills, role), [skills, role]);
  const actions = useMemo(() => rankedActions(skills, role), [skills, role]);
  const top = actions[0];
  const lastCalc = activity[0]?.at ?? new Date().toISOString();

  if (!ready) {
    return <div className="p-8 text-sm text-muted-foreground">Loading your dashboard...</div>;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h1 className="font-display text-xl font-bold">We couldn't load your dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  const share = async (skill: Skill) => {
    const rec = getRecords().find((r) => r.id === skill.verificationRecordId);
    if (!rec) return toast.error("No evidence report yet for this skill");
    await navigator.clipboard.writeText(`${window.location.origin}/report/${rec.token}`);
    toast.success(`Copied the ${skill.name} evidence report link`);
  };

  const grouped = {
    verified: skills.filter((s) => skillState(s) === "verified"),
    "in-review": skills.filter((s) => skillState(s) === "in-review"),
    "needs-evidence": skills.filter((s) => skillState(s) === "needs-evidence"),
    claimed: skills.filter((s) => skillState(s) === "claimed"),
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {student?.yearOfStudy} · Targeting{" "}
            <span className="font-medium text-foreground">{role}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, {student?.name.split(" ")[0]}.
          </h1>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/onboarding" })}>
          Edit target role
        </Button>
      </div>

      {/* 1. Readiness score */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary-soft via-card to-teal-soft p-8 shadow-lg shadow-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Readiness score
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
            <TrendingUp className="h-3 w-3" /> Smoothed over time
          </span>
        </div>

        <div className="mt-4 font-display text-7xl font-extrabold tracking-tight tabular-nums transition-all duration-500 sm:text-8xl">
          {smoothed.low}
          <span className="text-muted-foreground/60">–</span>
          {smoothed.high}
          <span className="text-4xl text-muted-foreground">%</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Built from{" "}
          <span className="font-semibold text-foreground">{PROJECT_EVIDENCE.length} analysed projects</span> and{" "}
          <span className="font-semibold text-foreground">{grouped.verified.length} verified skills</span>. A range,
          not a single number — a single number would be false precision.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Last recalculated {new Date(lastCalc).toLocaleString()}
          {activity[0]?.reason ? ` · after ${activity[0].reason}` : ""}
        </p>

        <div className="mt-6">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 rounded-full gradient-brand transition-all duration-500"
              style={{ left: `${smoothed.low}%`, right: `${100 - smoothed.high}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>Job-ready threshold · 75%</span>
            <span>100</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpenWhy((v) => !v)}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium hover:bg-background"
          aria-expanded={openWhy}
        >
          <Scale className="h-3.5 w-3.5 text-primary" />
          Why this score?
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openWhy ? "rotate-180" : ""}`} />
        </button>
        {openWhy && (
          <div className="mt-4 space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
            {factors.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{f.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {f.value}/{f.max} pts
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full gradient-brand" style={{ width: `${(f.value / f.max) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{f.why}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/evidence">
                <Button size="sm" variant="outline" className="rounded-full">See the evidence</Button>
              </Link>
              <Link to="/appeals">
                <Button size="sm" variant="ghost" className="rounded-full">Appeal a result</Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 2. Skill gaps */}
      <section className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">Your skills, by status</h2>
          <Link to="/skills" className="text-sm text-primary underline">
            Full skill gap analysis
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["verified", "in-review", "needs-evidence", "claimed"] as const).map((state) => (
            <div key={state} className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <SkillStatusBadge state={state} showHint />
              <ul className="mt-3 space-y-2">
                {grouped[state].map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{s.name}</span>
                    {state === "verified" && (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {skillLevel(s)} · {s.confidenceLow}–{s.confidenceHigh}% · {freshnessLabel(s.lastVerifiedAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => share(s)}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Share2 className="h-3 w-3" /> Share
                        </button>
                      </>
                    )}
                    {state !== "verified" && (
                      <Link
                        to="/verify"
                        search={{ skill: s.name }}
                        className="ml-auto text-xs text-primary hover:underline"
                      >
                        Verify
                      </Link>
                    )}
                  </li>
                ))}
                {grouped[state].length === 0 && (
                  <li className="text-sm text-muted-foreground">Nothing here.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Target job readiness */}
      <section className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
            <Briefcase className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg font-bold">Readiness for {role}</h2>
          <span className="ml-auto font-display text-2xl font-extrabold tabular-nums">
            {roleFit.low}–{roleFit.high}%
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full gradient-brand" style={{ width: `${roleFit.pct}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Matched against {roleFit.reqs.length} requirements for this role. Core requirements count double.
        </p>
        {roleFit.missing.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Still missing for this role
            </div>
            <ul className="mt-2 space-y-2">
              {roleFit.missing.slice(0, 4).map((m) => (
                <li key={m.skill} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
                  <AlertCircle className="h-3.5 w-3.5 text-warning" />
                  <span className="font-medium">{m.skill}</span>
                  <span className="text-xs text-muted-foreground">{m.why}</span>
                  <span
                    className={
                      m.importance === "core"
                        ? "ml-auto rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-medium text-coral"
                        : "ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    }
                  >
                    {m.importance}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 4. Next best action */}
      {top && (
        <section className="mt-8 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/95 to-primary p-7 text-primary-foreground shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
            <Zap className="h-4 w-4" /> Your one next action
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold">{top.title}</h2>
          <p className="mt-1 text-primary-foreground/85">
            Build: <span className="font-semibold">{top.project}</span>
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-background/15 px-3 py-2">
              Job requirement<span className="block text-primary-foreground/80">{top.jobRequirement}</span>
            </div>
            <div className="rounded-xl bg-background/15 px-3 py-2">
              Difficulty<span className="block text-primary-foreground/80">{top.difficulty}</span>
            </div>
            <div className="rounded-xl bg-background/15 px-3 py-2">
              Expected impact<span className="block text-primary-foreground/80">+{top.impact} readiness points</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/verify" search={{ skill: top.missingSkill }}>
              <Button variant="secondary" className="rounded-full bg-background text-foreground hover:bg-background/90">
                Start now <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/roadmap">
              <Button variant="ghost" className="rounded-full text-primary-foreground hover:bg-background/15">
                See the full roadmap
              </Button>
            </Link>
          </div>
        </section>
      )}

      <div className="mt-8">
        <LearningTaskList
          tasks={learningTasks}
          loading={tasksLoading}
          error={tasksError}
          completingTaskId={completingTaskId}
          onComplete={(taskId) => void completeTask(taskId)}
        />
      </div>

      <div className="mt-8">
        <SkillInventory skills={skills} />
      </div>

      {/* 5. Recent evidence */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-lg font-bold">Recent evidence</h2>
          <ul className="mt-4 space-y-2">
            {PROJECT_EVIDENCE.map((p) => (
              <li key={p.id} className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-xs text-muted-foreground">proves {p.skills.join(", ")}</span>
                  <span className="ml-auto text-xs text-success">+{p.readinessImpact} pts</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.tests.passing}/{p.tests.count} tests · {p.difficulty} · {new Date(p.completedAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
          <Link to="/evidence" className="mt-4 inline-block text-sm text-primary underline">
            Open all evidence records
          </Link>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-soft text-teal">
              <Activity className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold">Why your score changed</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {activity.slice(0, 6).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-medium">{a.reason}</span>
                {a.detail && <span className="text-muted-foreground">— {a.detail}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
              </li>
            ))}
            {activity.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No recalculations yet. Connect an account to get started.
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary-soft/40 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Target className="h-4 w-4" />
          </span>
          <div>
            <div className="font-semibold">Everything here traces back to evidence</div>
            <p className="text-sm text-muted-foreground">
              Score → skills → projects → reports. Follow any number to its proof.
            </p>
          </div>
        </div>
        <Link to="/skills">
          <Button className="rounded-full">
            See skill gaps <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}

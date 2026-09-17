import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Target,
  Clock3,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { AnimatedCircularProgress } from "@/components/ui/animated-circular-progress";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { SkillStatusBadge } from "@/components/skill-status-badge";
import { cn } from "@/lib/utils";
import { getSkills, type Skill, type Student } from "@/lib/skillbridge-store";
import { getAuthenticatedProfile } from "@/lib/supabase/profile";
import { useServerFn } from "@tanstack/react-start";
import { loadOrCreateRoadmap, updateRoadmapStep, type PersistedRoadmapStep } from "@/lib/supabase/roadmap";
import { buildSteps } from "@/lib/roadmap-generator";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Your roadmap — SkillBridge AI" },
      {
        name: "description",
        content:
          "A sequenced, checklist-style plan that takes you from where you are to job-ready.",
      },
      { property: "og:title", content: "Your roadmap — SkillBridge AI" },
      {
        property: "og:description",
        content: "One step at a time — a plain-language plan to reach your target role.",
      },
    ],
  }),
  component: RoadmapPage,
});

const DONE_KEY = "skillbridge:roadmap-done:v1";

type Step = PersistedRoadmapStep & { detail: string; appId: string };

type StepAction = {
  label: string;
  to: "/onboarding" | "/connections" | "/projects" | "/resume" | "/interview" | "/jobs";
};

function actionForStep(step: Step): StepAction {
  if (step.appId.startsWith("core-") || step.appId.startsWith("helpful-")) {
    return { label: "Verify with a proof project", to: "/projects" };
  }
  switch (step.appId) {
    case "profile":
      return { label: "Set up your profile", to: "/onboarding" };
    case "connect":
      return { label: "Connect your accounts", to: "/connections" };
    case "resume":
      return { label: "Generate your resume", to: "/resume" };
    case "interview":
      return { label: "Run a mock interview", to: "/interview" };
    case "apply":
      return { label: "Browse matched jobs", to: "/jobs" };
    default:
      return { label: "Start a proof project", to: "/projects" };
  }
}

function RoadmapPage() {
  const loadRoadmap = useServerFn(loadOrCreateRoadmap);
  const saveStep = useServerFn(updateRoadmapStep);
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [student, setStudent] = React.useState<Student | null>(null);
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [progressPercentage, setProgressPercentage] = React.useState(0);
  const journeyRef = React.useRef<HTMLDivElement>(null);
  const milestoneRefs = React.useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});

  React.useEffect(() => {
    let cancelled = false;
    const localSkills = getSkills();
    setSkills(localSkills);

    async function loadProfile(): Promise<Student | null> {
      try {
        const { student: profileStudent } = await getAuthenticatedProfile();
        if (!cancelled) setStudent(profileStudent);
        return profileStudent;
      } catch {
        if (!cancelled) setStudent(null);
        return null;
      }
    }

    void loadProfile().then(async (profileStudent) => {
      let completedStepIds: string[] = [];
      try {
        const raw = localStorage.getItem(DONE_KEY);
        completedStepIds = raw ? JSON.parse(raw) as string[] : [];
      } catch {
        completedStepIds = [];
      }
      const autoCompletedIds = buildSteps(localSkills, profileStudent?.targetRole)
        .filter((step) => step.auto)
        .map((step) => step.id);
      const roadmap = await loadRoadmap({ data: { completedStepIds: [...new Set([...completedStepIds, ...autoCompletedIds])] } });
      if (!cancelled) {
        setProgressPercentage(roadmap.progressPercentage);
        setSteps(roadmap.steps.map((step) => ({ ...step, detail: step.description ?? "" })));
      }
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const getMilestoneRef = (id: string) => {
    if (!milestoneRefs.current[id]) {
      milestoneRefs.current[id] = React.createRef<HTMLDivElement>();
    }
    return milestoneRefs.current[id];
  };

  const isDone = (step: Step) => step.completed;
  const completed = steps.filter(isDone).length;
  const pct = progressPercentage;

  const toggle = async (id: string) => {
    const step = steps.find((item) => item.id === id);
    if (!step) return;
    const isConnectStep = step.title === "Connect your accounts";
    if (isConnectStep) {
      console.log("[ROADMAP_CONNECT_DIAG] click handler started", {
        title: step.title,
        stepId: step.id,
        completed: step.completed,
      });
    }
    try {
      if (isConnectStep) {
        console.log("[ROADMAP_CONNECT_DIAG] before updateRoadmapStep", {
          title: step.title,
          stepId: step.id,
          completed: step.completed,
        });
      }
      const updated = await saveStep({ data: { stepId: id, completed: !step.completed } });
      if (isConnectStep) {
        console.log("[ROADMAP_CONNECT_DIAG] updateRoadmapStep resolved", {
          title: step.title,
          stepId: step.id,
          completed: step.completed,
          result: updated,
        });
      }
      setSteps((current) => current.map((item) => item.id === id ? { ...item, status: updated.status, progress_percentage: updated.progress_percentage, completed: updated.status === "completed" } : item));
      setProgressPercentage((current) => Math.round(((steps.reduce((total, item) => total + (item.id === id ? updated.progress_percentage : item.progress_percentage), 0)) / steps.length)));
    } catch (error) {
      if (isConnectStep) {
        console.error("[ROADMAP_CONNECT_DIAG] updateRoadmapStep failed", {
          title: step.title,
          stepId: step.id,
          completed: step.completed,
          error,
        });
      }
      console.error("[ROADMAP_STEP_UPDATE_DIAG]", error);
    }
  };

  const nextIndex = steps.findIndex((s) => !isDone(s));
  const nextStep = nextIndex >= 0 ? steps[nextIndex] : undefined;

  const skillForStep = (step: Step) => {
    const skillName = step.title.replace(/^(Verify|Strengthen) /, "");
    return skillName === step.title
      ? undefined
      : skills.find((skill) => skill.name.toLowerCase() === skillName.toLowerCase());
  };

  const categoryForStep = (step: Step, skill?: Skill) => {
    if (skill?.category) return skill.category;
    if (step.appId === "profile" || step.appId === "connect") return "Career foundation";
    if (step.appId === "resume") return "Personal brand";
    if (step.appId === "interview") return "Interview readiness";
    if (step.appId === "apply") return "Job search";
    return "Career milestone";
  };

  return (
    <AppShell>
      <div className="space-y-10 pb-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_42%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1">
                  <Target className="h-3.5 w-3.5" />
                  Career journey
                </span>
                <span className="text-muted-foreground">{steps.length} milestones</span>
              </div>
              <div>
                <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                  Your Career Roadmap
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                  A clear sequence from your current foundation to your next opportunity.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Target role</span>
                <span className="font-semibold text-foreground">
                  {student?.targetRole || "Set your target role"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
              <AnimatedCircularProgress value={pct} size={112} strokeWidth={9} />
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Overall progress</dt>
                  <dd className="font-display text-2xl font-bold tabular-nums">
                    <NumberTicker value={pct} />%
                  </dd>
                </div>
                <div className="flex gap-4">
                  <div>
                    <dt className="text-muted-foreground">Complete</dt>
                    <dd className="font-semibold tabular-nums">
                      <NumberTicker value={completed} />{" "}
                      <span className="font-normal text-muted-foreground">milestones</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="font-semibold tabular-nums">
                      <NumberTicker value={steps.length - completed} />{" "}
                      <span className="font-normal text-muted-foreground">milestones</span>
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <section aria-labelledby="journey-heading" className="min-w-0">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  The path forward
                </p>
                <h2
                  id="journey-heading"
                  className="mt-1 font-display text-2xl font-bold tracking-tight"
                >
                  Your career journey
                </h2>
              </div>
              {nextStep ? (
                <p className="text-sm text-muted-foreground">
                  Next: <span className="font-semibold text-foreground">{nextStep.title}</span>
                </p>
              ) : (
                <p className="text-sm font-semibold text-primary">Every milestone is complete</p>
              )}
            </div>

            <div ref={journeyRef} className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 hidden sm:block"
              >
                {steps.slice(0, -1).map((step, index) => (
                  <AnimatedBeam
                    key={`${step.id}-beam`}
                    containerRef={journeyRef}
                    fromRef={getMilestoneRef(step.id)}
                    toRef={getMilestoneRef(steps[index + 1].id)}
                    pathColor={isDone(step) ? "var(--primary)" : "var(--border)"}
                    pathWidth={isDone(step) ? 2.5 : 2}
                    duration={4.5}
                  />
                ))}
              </div>
              <ol className="relative z-10 space-y-5">
                {steps.map((step, i) => {
                  const complete = isDone(step);
                  const isCurrent = i === nextIndex;
                  const isUpcoming = !complete && !isCurrent;
                  const skill = skillForStep(step);
                  const action = actionForStep(step);

                  return (
                    <li
                      key={step.id}
                      aria-current={isCurrent ? "step" : undefined}
                      className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4"
                    >
                      <div
                        ref={getMilestoneRef(step.id)}
                        className="flex min-h-32 items-start justify-center pt-5"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(step.id)}
                          aria-pressed={complete}
                          aria-label={
                            complete
                              ? `Mark ${step.title} as not done`
                              : `Mark ${step.title} as done`
                          }
                          className={cn(
                            "relative z-10 grid h-10 w-10 place-items-center rounded-full border-4 border-background bg-card transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            complete && "bg-primary text-primary-foreground",
                            isCurrent &&
                              "border-primary/20 bg-primary text-primary-foreground shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_12%,transparent)]",
                            isUpcoming && "text-muted-foreground",
                          )}
                        >
                          {complete ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-bold tabular-nums">{i + 1}</span>
                          )}
                        </button>
                      </div>
                      <MagicCard
                        className={cn(
                          "min-w-0 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md",
                          complete && "opacity-80",
                          isCurrent &&
                            "border-primary/50 bg-primary-soft/50 shadow-lg shadow-primary/10",
                          isUpcoming && "bg-card",
                        )}
                        glowColor={isCurrent ? "var(--primary)" : "var(--teal)"}
                      >
                        {isCurrent && <BorderBeam color="var(--primary)" size={72} duration={7} />}
                        <div className="relative p-5 sm:p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Milestone {String(i + 1).padStart(2, "0")}
                            </span>
                            {complete && (
                              <Badge
                                variant="secondary"
                                className="gap-1 rounded-full text-primary"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Completed
                              </Badge>
                            )}
                            {isCurrent && <Badge className="rounded-full">Current step</Badge>}
                            {isUpcoming && (
                              <Badge
                                variant="outline"
                                className="rounded-full text-muted-foreground"
                              >
                                Upcoming
                              </Badge>
                            )}
                          </div>
                          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <h3
                                className={cn(
                                  "font-display text-xl font-bold tracking-tight",
                                  complete && "text-muted-foreground",
                                )}
                              >
                                {step.title}
                              </h3>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                {step.detail}
                              </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Clock3 className="h-3.5 w-3.5" />
                              Sequence {i + 1} of {steps.length}
                            </span>
                          </div>
                          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                              {categoryForStep(step, skill)}
                            </span>
                            {skill ? (
                              <SkillStatusBadge state={skill.status} />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No skill evidence attached
                              </span>
                            )}
                            {skill?.evidenceCount ? (
                              <span className="text-xs text-muted-foreground">
                                {skill.evidenceCount} evidence item
                                {skill.evidenceCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </div>
                          {isCurrent && (
                            <div className="mt-5">
                              <Button asChild variant="default" className="rounded-full">
                                <Link to={action.to}>
                                  {action.label} <ArrowRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>
                      </MagicCard>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-primary/20 bg-primary-soft/45 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" /> Roadmap guidance
              </div>
              <h2 className="mt-3 font-display text-lg font-bold">Keep the next step small</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {nextStep
                  ? `Start with “${nextStep.title}”. Finishing one milestone gives you a concrete signal to build on before moving forward.`
                  : "Review your evidence and keep your strongest proof current as you prepare to apply."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Journey legend</p>
              <div className="mt-4 grid gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Completed milestone
                </span>
                <span className="flex items-center gap-2">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    •
                  </span>{" "}
                  Current / next step
                </span>
                <span className="flex items-center gap-2">
                  <Circle className="h-4 w-4" /> Upcoming milestone
                </span>
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4" /> Locked when a dependency exists
                </span>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                No locked dependencies are represented in your current roadmap.
              </p>
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border/70 pt-6">
          <Button asChild className="rounded-full">
            <Link to="/projects">
              Start a proof project <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/skills">See your skill gap</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, ShieldAlert, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getSkills, type Skill } from "@/lib/skillbridge-store";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job matches — SkillBridge AI" },
      {
        name: "description",
        content: "Roles ranked by how well your verified skills fit — nothing is ever sent without your approval.",
      },
      { property: "og:title", content: "Job matches — SkillBridge AI" },
      { property: "og:description", content: "See why each role fits, then approve every application yourself." },
    ],
  }),
  component: JobsPage,
});

const APPS_KEY = "skillbridge:applications:v1";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  requires: string[];
};

const JOBS: Job[] = [
  { id: "j1", title: "Junior Backend Engineer", company: "Northwind Labs", location: "Remote · India", requires: ["Python", "SQL", "Docker", "Git & GitHub"] },
  { id: "j2", title: "Graduate Software Engineer", company: "Foxglove", location: "Bengaluru · Hybrid", requires: ["Python", "SQL", "System Design"] },
  { id: "j3", title: "Frontend Developer (Entry)", company: "Papertrail", location: "Remote", requires: ["React", "TypeScript", "Git & GitHub"] },
  { id: "j4", title: "Data Analyst Intern", company: "Bluecap Health", location: "Pune · On-site", requires: ["SQL", "Python"] },
  { id: "j5", title: "Platform Engineer Trainee", company: "Orbital", location: "Remote", requires: ["Docker", "AWS", "Git & GitHub"] },
];

type AppStatus = "drafted" | "approved" | "sent";

function fit(job: Job, skills: Skill[]) {
  const verified = new Set(skills.filter((s) => s.status === "verified").map((s) => s.name.toLowerCase()));
  const claimed = new Set(skills.filter((s) => s.status === "claimed").map((s) => s.name.toLowerCase()));
  let score = 0;
  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];
  for (const r of job.requires) {
    const k = r.toLowerCase();
    if (verified.has(k)) {
      score += 1;
      matched.push(r);
    } else if (claimed.has(k)) {
      score += 0.4;
      partial.push(r);
    } else {
      missing.push(r);
    }
  }
  const pct = Math.round((score / job.requires.length) * 100);
  return { low: Math.max(0, pct - 7), high: Math.min(100, pct + 6), pct, matched, partial, missing };
}

function JobsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [apps, setApps] = useState<Record<string, AppStatus>>({});

  useEffect(() => {
    setSkills(getSkills());
    try {
      const raw = localStorage.getItem(APPS_KEY);
      if (raw) setApps(JSON.parse(raw) as Record<string, AppStatus>);
    } catch {
      /* ignore */
    }
  }, []);

  const update = (id: string, status: AppStatus) => {
    const next = { ...apps, [id]: status };
    setApps(next);
    localStorage.setItem(APPS_KEY, JSON.stringify(next));
  };

  const ranked = JOBS.map((j) => ({ job: j, ...fit(j, skills) })).sort((a, b) => b.pct - a.pct);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Job matches</h1>
          <p className="max-w-2xl text-muted-foreground">
            Ranked by how much of each role you can already prove. Fit is shown as a range — it's an estimate, not a
            verdict.
          </p>
        </header>

        <div className="flex items-start gap-3 rounded-3xl border border-border bg-primary-soft/50 p-5">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
          <p className="text-sm">
            <span className="font-medium">Nothing is ever sent automatically.</span> Every application waits for you to
            draft it, approve it, and then send it.
          </p>
        </div>

        <div className="grid gap-4">
          {ranked.map(({ job, low, high, matched, partial, missing }) => {
            const status = apps[job.id];
            return (
              <div key={job.id} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold">{job.title}</h2>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" /> {job.company} · {job.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold">
                      {low}–{high}%
                    </p>
                    <p className="text-xs text-muted-foreground">estimated fit</p>
                  </div>
                </div>

                <Progress value={(low + high) / 2} className="mt-4 h-2" />

                <div className="mt-4 flex flex-wrap gap-2">
                  {matched.map((m) => (
                    <Badge key={m} className="rounded-full">
                      {m} · verified
                    </Badge>
                  ))}
                  {partial.map((m) => (
                    <Badge key={m} variant="secondary" className="rounded-full">
                      {m} · claimed
                    </Badge>
                  ))}
                  {missing.map((m) => (
                    <Badge key={m} variant="outline" className="rounded-full text-muted-foreground">
                      {m} · not yet
                    </Badge>
                  ))}
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {matched.length > 0
                    ? `You can prove ${matched.join(", ")} today.`
                    : "You can't prove any of these yet — worth a proof project first."}
                  {missing.length > 0 && ` Closing ${missing[0]} would move this up the list.`}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {!status && (
                    <Button
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => {
                        update(job.id, "drafted");
                        toast.success("Draft ready", { description: "Review it, then approve when you're happy." });
                      }}
                    >
                      Draft tailored application
                    </Button>
                  )}
                  {status === "drafted" && (
                    <>
                      <span className="text-sm text-muted-foreground">Draft ready — needs your approval.</span>
                      <Button className="rounded-full" onClick={() => update(job.id, "approved")}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                    </>
                  )}
                  {status === "approved" && (
                    <>
                      <span className="text-sm text-muted-foreground">Approved by you.</span>
                      <Button
                        className="rounded-full"
                        onClick={() => {
                          update(job.id, "sent");
                          toast.success("Application sent", { description: `${job.title} at ${job.company}` });
                        }}
                      >
                        <Send className="mr-1 h-4 w-4" /> Send now
                      </Button>
                    </>
                  )}
                  {status === "sent" && (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      <CheckCircle2 className="h-4 w-4" /> Sent
                    </span>
                  )}
                  <Button asChild variant="ghost" className="rounded-full">
                    <Link to="/resume">View resume used</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

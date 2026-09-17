import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Terminal, Mic, GraduationCap, ArrowRight, ShieldCheck, Info, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getSkills, saveSkills, upsertRecord, pushActivity, type VerificationRecord } from "@/lib/skillbridge-store";

export const Route = createFileRoute("/verify-alt")({
  head: () => ({
    meta: [
      { title: "Other ways to verify — SkillBridge AI" },
      { name: "description", content: "Live coding, oral walkthrough, or instructor sign-off — every path counts equally." },
    ],
  }),
  component: VerifyAltPage,
});

type PathId = "live" | "oral" | "instructor";

function VerifyAltPage() {
  const [busy, setBusy] = useState<PathId | null>(null);
  const [pending, setPending] = useState<{ email: string } | null>(null);
  const [skill, setSkill] = useState("React");
  const [instructor, setInstructor] = useState("");

  const complete = (path: PathId) => {
    setBusy(path);
    setTimeout(() => {
      const id = crypto.randomUUID();
      const method =
        path === "live" ? "live-coding" : path === "oral" ? "oral-walkthrough" : "instructor-signoff";
      const rec: VerificationRecord = {
        id,
        token: id.slice(0, 8),
        skillId: `alt-${id.slice(0, 6)}`,
        skillName: skill,
        studentName: "Alex Rivera",
        method,
        outcome: path === "instructor" ? "partial" : "verified",
        evidenceSummary:
          path === "live"
            ? "Timed in-browser coding challenge completed"
            : path === "oral"
            ? "5-min recorded project walkthrough"
            : `Sign-off requested from ${instructor || "instructor"}`,
        timestamp: new Date().toISOString(),
        reason:
          path === "instructor"
            ? "Awaiting instructor confirmation — will convert to a strong signal on approval."
            : "Timed in-platform check completed — strong evidence.",
        signals:
          path === "live"
            ? [{ type: "live_check", label: "Timed live-coding check", outcome: "pass", strength: 0.88, detail: "Completed under time pressure" }]
            : path === "oral"
            ? [{ type: "graded_project", label: "Oral project walkthrough", outcome: "pass", strength: 0.82, detail: "Clearly explained architecture and tradeoffs" }]
            : [{ type: "instructor_signoff", label: "Instructor sign-off requested", outcome: "pending", strength: 0.4, detail: `Pending confirmation from ${instructor}` }],
      };
      upsertRecord(rec);

      if (path !== "instructor") {
        const skills = getSkills();
        const existing = skills.find((s) => s.name.toLowerCase() === skill.toLowerCase());
        if (existing) {
          existing.status = "verified";
          existing.lastVerifiedAt = rec.timestamp;
          existing.verificationMethod = method;
          existing.verificationRecordId = rec.id;
          existing.confidenceLow = 78;
          existing.confidenceHigh = 90;
        } else {
          skills.push({
            id: crypto.randomUUID(),
            name: skill,
            status: "verified",
            source: "project",
            lastVerifiedAt: rec.timestamp,
            verificationMethod: method,
            verificationRecordId: rec.id,
            confidenceLow: 78,
            confidenceHigh: 90,
          });
        }
        saveSkills(skills);
      }
      pushActivity({
        reason:
          path === "live"
            ? `Live-coding check — ${skill}`
            : path === "oral"
            ? `Oral walkthrough — ${skill}`
            : `Instructor sign-off requested — ${skill}`,
        detail: rec.reason,
      });

      if (path === "instructor") {
        setPending({ email: instructor });
        toast("Sign-off request sent", { description: `Waiting on ${instructor}` });
      } else {
        toast.success(`${skill} verified via ${path === "live" ? "live coding" : "oral walkthrough"}`);
      }
      setBusy(null);
    }, 1100);
  };

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Other ways to verify
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          These paths carry the same weight as GitHub-based verification — sometimes more.
          Pick whichever best shows what you can actually do.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-border/60 bg-primary-soft/40 p-4 text-sm">
        <Label htmlFor="alt-skill" className="text-xs">Skill you're verifying</Label>
        <Input id="alt-skill" value={skill} onChange={(e) => setSkill(e.target.value)} className="mt-1 max-w-sm" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <PathCard
          icon={Terminal}
          tint="primary"
          title="Timed live-coding check"
          weight="Equal weight — in-platform"
          desc="A short in-browser challenge. We record the whole session so recruiters can trust the result."
          cta={busy === "live" ? "Running…" : "Start check"}
          busy={busy === "live"}
          onClick={() => complete("live")}
        />
        <PathCard
          icon={Mic}
          tint="teal"
          title="Oral project walkthrough"
          weight="Equal weight — in-platform"
          desc="Record a 3–5 min video explaining a project you built. Our reviewer scores clarity and depth."
          cta={busy === "oral" ? "Uploading…" : "Upload walkthrough"}
          busy={busy === "oral"}
          onClick={() => complete("oral")}
        />
        <div className="rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-coral-soft text-coral">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Instructor sign-off</div>
              <div className="text-xs text-muted-foreground">Equal weight — human vouch</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Send a professor or TA a one-click confirmation link. Their approval creates a
            verification record signed by them.
          </p>
          <div className="mt-3 space-y-2">
            <Label htmlFor="inst" className="text-xs">Instructor email</Label>
            <Input
              id="inst"
              placeholder="prof@university.edu"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
            />
            <Button
              className="w-full rounded-full"
              disabled={busy === "instructor" || !instructor}
              onClick={() => complete("instructor")}
            >
              {busy === "instructor" ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Sending…</> : "Request sign-off"}
            </Button>
            {pending && (
              <p className="rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                Pending instructor confirmation from {pending.email}. We'll notify you the moment it's approved.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Not sure which to pick? Live-coding is fastest. Oral walkthroughs are great if you learn better
          by explaining. Instructor sign-off is the strongest signal when you have someone who's seen your work.
          <div className="mt-2">
            <Link to="/projects" className="font-medium text-primary hover:underline">
              Prefer to link a GitHub repo instead? →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PathCard({
  icon: Icon,
  tint,
  title,
  weight,
  desc,
  cta,
  busy,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: "primary" | "teal";
  title: string;
  weight: string;
  desc: string;
  cta: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-3">
        <span
          className={
            tint === "primary"
              ? "grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary"
              : "grid h-11 w-11 place-items-center rounded-2xl bg-teal-soft text-teal"
          }
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{weight}</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
      <Button className="mt-4 w-full rounded-full" onClick={onClick} disabled={busy}>
        {busy ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Working…</> : <>{cta} <ArrowRight className="ml-1 h-4 w-4" /></>}
      </Button>
      <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[11px] font-medium">
        <ShieldCheck className="h-3 w-3" /> Verified in-platform
      </div>
    </div>
  );
}

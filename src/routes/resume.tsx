import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, ShieldCheck, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  getRecords,
  getSkills,
  getStudent,
  type Skill,
  type Student,
  type VerificationRecord,
} from "@/lib/skillbridge-store";
import { VerificationBadge } from "@/components/verification-badge";

export const Route = createFileRoute("/resume")({
  head: () => ({
    meta: [
      { title: "Verified resume — SkillBridge AI" },
      {
        name: "description",
        content: "A resume generated only from skills you've actually verified, with evidence attached.",
      },
      { property: "og:title", content: "Verified resume — SkillBridge AI" },
      { property: "og:description", content: "Every line on this resume is backed by evidence you can share." },
    ],
  }),
  component: ResumePage,
});

function ResumePage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [includeClaimed, setIncludeClaimed] = useState(false);

  useEffect(() => {
    setStudent(getStudent());
    setSkills(getSkills());
    setRecords(getRecords());
  }, []);

  const verified = skills.filter((s) => s.status === "verified");
  const claimed = skills.filter((s) => s.status === "claimed");

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Your verified resume</h1>
          <p className="max-w-2xl text-muted-foreground">
            Built automatically from evidence, not from what you typed about yourself. Anything unverified is left
            off by default — you can add it, clearly labelled.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Include claimed skills</p>
              <p className="text-sm text-muted-foreground">
                They'll appear in a separate section marked "self-reported".
              </p>
            </div>
          </div>
          <Switch checked={includeClaimed} onCheckedChange={setIncludeClaimed} aria-label="Include claimed skills" />
        </div>

        <article className="rounded-3xl border border-border bg-card p-8">
          <h2 className="font-display text-2xl font-bold">{student?.name || "Your name"}</h2>
          <p className="text-muted-foreground">
            {(student?.targetRole || "Aspiring software engineer") +
              (student?.yearOfStudy ? ` · ${student.yearOfStudy}` : "")}
          </p>
          {student?.email && <p className="text-sm text-muted-foreground">{student.email}</p>}

          <section className="mt-8">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Verified skills
            </h3>
            <ul className="mt-3 space-y-3">
              {verified.map((s) => {
                const rec = records.find((r) => r.id === s.verificationRecordId);
                return (
                  <li key={s.id} className="rounded-2xl border border-border/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {s.verificationMethod && <VerificationBadge method={s.verificationMethod} />}
                    </div>
                    {rec && <p className="mt-1 text-sm text-muted-foreground">{rec.evidenceSummary}</p>}
                  </li>
                );
              })}
              {verified.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing verified yet — <Link to="/projects" className="text-primary underline">start a proof project</Link>.
                </li>
              )}
            </ul>
          </section>

          {includeClaimed && claimed.length > 0 && (
            <section className="mt-8">
              <h3 className="font-display text-lg font-semibold">Self-reported skills</h3>
              <p className="text-sm text-muted-foreground">Not verified yet — be ready to talk about these.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {claimed.map((s) => (
                  <span key={s.id} className="rounded-full bg-muted px-3 py-1 text-sm">
                    {s.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h3 className="font-display text-lg font-semibold">Evidence</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {records.map((r) => (
                <li key={r.id}>
                  <Link to="/v/$token" params={{ token: r.token }} className="text-primary underline">
                    {r.skillName} verification record
                  </Link>{" "}
                  — {r.reason}
                </li>
              ))}
            </ul>
          </section>
        </article>

        <Button
          className="rounded-full"
          onClick={() => toast.success("Resume ready", { description: "Export is mocked in this prototype." })}
        >
          <Download className="mr-1 h-4 w-4" /> Download resume
        </Button>
      </div>
    </AppShell>
  );
}

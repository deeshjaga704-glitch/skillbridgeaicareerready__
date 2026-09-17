import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Scale, ArrowRight, ShieldQuestion } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getAppeals, submitAppeal, type Appeal } from "@/lib/skillbridge-store";

const search = z.object({
  skillId: z.string().optional(),
  skillName: z.string().optional(),
  outcome: z.string().optional(),
});

export const Route = createFileRoute("/appeals")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Appeal a verification result — SkillBridge AI" },
      { name: "description", content: "Every not-verified or partial result can be appealed with more context." },
    ],
  }),
  component: AppealsPage,
});

function AppealsPage() {
  const params = Route.useSearch();
  const [skillName, setSkillName] = useState(params.skillName ?? "");
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [list, setList] = useState<Appeal[]>(() => (typeof window !== "undefined" ? getAppeals() : []));

  const submit = () => {
    if (!skillName || !reason) {
      toast.error("Add the skill and a reason");
      return;
    }
    const next = submitAppeal({
      skillId: params.skillId ?? `manual-${skillName}`,
      skillName,
      originalOutcome: (params.outcome as Appeal["originalOutcome"]) ?? "not_verified",
      reason,
      evidenceUrl: evidenceUrl || undefined,
    });
    setList([next, ...list]);
    setReason("");
    setEvidenceUrl("");
    toast.success("Appeal submitted — we'll review within 48h");
  };

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Appeal a verification result
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every partial or not-verified result comes with a plain-language reason.
          If you think we got it wrong, add more context and we'll re-review.
        </p>
      </div>

      {params.outcome && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <ShieldQuestion className="mt-0.5 h-4 w-4 text-warning" />
          <div>
            <div className="font-medium">Original outcome for {params.skillName}: {String(params.outcome).replace("_", " ")}</div>
            <div className="text-muted-foreground">
              Reason on file: "No commits found in the last 90 days matching this skill." Add anything we missed.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <Scale className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold">Your appeal</h2>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="sk">Skill</Label>
              <Input id="sk" value={skillName} onChange={(e) => setSkillName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="re">Why do you think this was wrong?</Label>
              <Textarea
                id="re"
                rows={5}
                placeholder="e.g. Most of my commits are in a private university repo not visible to GitHub public API."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ev">Additional evidence link (optional)</Label>
              <Input
                id="ev"
                placeholder="https://drive.google.com/…"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
            </div>
            <Button className="rounded-full" onClick={submit}>
              Submit appeal <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-lg font-bold">Your appeals</h2>
          <ul className="mt-4 space-y-2">
            {list.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No appeals yet.
              </li>
            )}
            {list.map((a) => (
              <li key={a.id} className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.skillName}</span>
                  <StatusPill status={a.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.reason}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Submitted {new Date(a.submittedAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-xs text-muted-foreground">
            <Link to="/dashboard" className="font-medium text-primary hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: Appeal["status"] }) {
  if (status === "pending")
    return <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">Pending review</span>;
  if (status === "upheld")
    return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Upheld</span>;
  return <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">Overturned</span>;
}

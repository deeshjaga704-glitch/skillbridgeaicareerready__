import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecordByToken, type VerificationRecord } from "@/lib/skillbridge-store";
import { VerificationBadge } from "@/components/verification-badge";
import { toast } from "sonner";

export const Route = createFileRoute("/v/$token")({
  head: ({ params }) => ({
    meta: [
      { title: `Verification record · ${params.token} — SkillBridge AI` },
      { name: "description", content: "Public, read-only verification record — what was checked, when, and how." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicRecord,
});

function PublicRecord() {
  const { token } = Route.useParams();
  const [rec, setRec] = useState<VerificationRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRec(getRecordByToken(token));
    setReady(true);
  }, [token]);

  if (!ready) return null;
  if (!rec) {
    throw notFound();
  }

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-4 sm:px-6">
          <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            SkillBridge <span className="text-primary">AI</span>
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Public verification record</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Verified skill</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
                {rec.skillName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                For <span className="font-medium text-foreground">{rec.studentName}</span> · Checked{" "}
                {new Date(rec.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <VerificationBadge method={rec.method} />
              <OutcomeBadge outcome={rec.outcome} />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why we consider this verified
            </div>
            <p className="mt-2 text-sm">{rec.reason}</p>
            <div className="mt-3 text-xs text-muted-foreground">Evidence: {rec.evidenceSummary}</div>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-lg font-bold">Signals checked</h2>
            <ul className="mt-3 space-y-2">
              {rec.signals.map((s) => (
                <li
                  key={s.type}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-sm"
                >
                  <span className="mt-0.5">
                    {s.outcome === "pass" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-warning" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Strength {Math.round(s.strength * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft/50 p-4">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              This record is read-only. Anyone with this link can view it — no login required.
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={copy}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Copy link
              </Button>
              <Link to="/">
                <Button size="sm" className="rounded-full">Learn about SkillBridge</Button>
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Record token: <code className="font-mono">{rec.token}</code>
        </p>
      </main>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: VerificationRecord["outcome"] }) {
  if (outcome === "verified")
    return <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">Verified</span>;
  if (outcome === "partial")
    return <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning-foreground">Partially verified</span>;
  return <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">Not verified</span>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Github, Code2, Linkedin, Trophy, RefreshCw, Link2, Check, Info, AlertTriangle, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getConnections,
  saveConnections,
  pushActivity,
  type Connection,
  type ConnectionId,
} from "@/lib/skillbridge-store";

export const Route = createFileRoute("/connections")({
  head: () => ({
    meta: [
      { title: "Connections — SkillBridge AI" },
      { name: "description", content: "Link GitHub, coding profiles, and LinkedIn to verify your skills." },
    ],
  }),
  component: ConnectionsPage,
});

const ICONS: Record<ConnectionId, React.ComponentType<{ className?: string }>> = {
  github: Github,
  leetcode: Code2,
  hackerrank: Trophy,
  linkedin: Linkedin,
};

const PLACEHOLDERS: Record<ConnectionId, string> = {
  github: "your-github-username",
  leetcode: "your-leetcode-username",
  hackerrank: "your-hackerrank-username",
  linkedin: "https://linkedin.com/in/you",
};

function daysSince(iso?: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function ConnectionsPage() {
  const [items, setItems] = useState<Connection[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    setItems(getConnections());
  }, []);

  const update = (next: Connection[]) => {
    setItems(next);
    saveConnections(next);
  };

  const connect = (id: ConnectionId) => {
    const handle = (drafts[id] ?? "").trim();
    if (!handle) {
      toast.error("Add a username or URL first");
      return;
    }
    const next = items.map((c) =>
      c.id === id
        ? { ...c, connected: true, handle, lastSyncedAt: new Date().toISOString(), syncState: "ok" as const }
        : c,
    );
    update(next);
    pushActivity({ reason: `${labelFor(id)} connected`, detail: handle });
    toast.success(`${labelFor(id)} connected`, { description: "Recalculating readiness…" });
  };

  const sync = (id: ConnectionId) => {
    setSyncing(id);
    setTimeout(() => {
      // Simulate best-effort sources occasionally failing
      const conn = items.find((c) => c.id === id);
      const shouldFail = conn?.quality === "best-effort" && Math.random() < 0.35;
      const next = items.map((c) =>
        c.id === id
          ? shouldFail
            ? { ...c, syncState: "unavailable" as const }
            : { ...c, lastSyncedAt: new Date().toISOString(), syncState: "ok" as const }
          : c,
      );
      update(next);
      if (shouldFail) {
        pushActivity({ reason: `${labelFor(id)} sync failed`, detail: "Best-effort source unavailable — score not updated" });
        toast.error(`${labelFor(id)} sync unavailable`, { description: "We'll keep showing your last known data, labeled as stale." });
      } else {
        pushActivity({ reason: `${labelFor(id)} sync`, detail: "Fresh signals pulled" });
        toast.success(`${labelFor(id)} synced`, { description: "Recalculating readiness…" });
      }
      setSyncing(null);
    }, 900);
  };

  const disconnect = (id: ConnectionId) => {
    const next = items.map((c) =>
      c.id === id ? { ...c, connected: false, handle: undefined, lastSyncedAt: undefined, syncState: undefined } : c,
    );
    update(next);
  };

  const labelFor = (id: ConnectionId) => items.find((c) => c.id === id)?.label ?? id;

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Connections
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Link the places your work already lives. Sources without an official API are
          labeled as <span className="font-medium">best-effort</span> — they contribute
          to your score as lower-confidence input, never silently.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((c) => {
          const Icon = ICONS[c.id];
          const stale = c.connected && c.syncState !== "ok" && daysSince(c.lastSyncedAt) >= 1;
          const unavailable = c.syncState === "unavailable";
          return (
            <div
              key={c.id}
              className="rounded-3xl border border-border/60 bg-card p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c.label}</span>
                      {c.quality !== "official-api" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                          <AlertTriangle className="h-3 w-3 text-warning" />
                          Best-effort signal — may be stale
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.connected ? c.handle : "Not connected"}
                    </div>
                  </div>
                </div>
                {c.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                    <Check className="h-3 w-3" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Not connected
                  </span>
                )}
              </div>

              {c.note && (
                <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {c.note}
                </p>
              )}

              {unavailable && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
                  <div>
                    <div className="font-medium text-warning-foreground">
                      Last synced {daysSince(c.lastSyncedAt)} day{daysSince(c.lastSyncedAt) === 1 ? "" : "s"} ago — sync currently unavailable.
                    </div>
                    <div className="text-muted-foreground">
                      Showing your last known data. This source is not contributing new signals to your score right now.
                    </div>
                  </div>
                </div>
              )}
              {stale && !unavailable && (
                <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Data may be stale — best-effort sources can lag reality.
                </div>
              )}

              {!c.connected ? (
                <div className="mt-4 space-y-2">
                  <Label htmlFor={`h-${c.id}`} className="text-xs">
                    {c.id === "linkedin" ? "Profile URL" : "Username"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`h-${c.id}`}
                      placeholder={PLACEHOLDERS[c.id]}
                      value={drafts[c.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [c.id]: e.target.value }))
                      }
                    />
                    <Button onClick={() => connect(c.id)} className="rounded-full">
                      <Link2 className="mr-1 h-4 w-4" /> Connect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Last synced{" "}
                    {c.lastSyncedAt
                      ? new Date(c.lastSyncedAt).toLocaleString()
                      : "just now"}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => sync(c.id)}
                      disabled={syncing === c.id}
                    >
                      <RefreshCw
                        className={`mr-1 h-3.5 w-3.5 ${syncing === c.id ? "animate-spin" : ""}`}
                      />
                      {syncing === c.id ? "Syncing…" : "Sync now"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-muted-foreground"
                      onClick={() => disconnect(c.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">How we label sources:</span> GitHub is a
        first-party API (high-confidence). LeetCode and HackerRank have no official API — we
        scrape best-effort and label the signal accordingly. LinkedIn is manual paste only.
        Best-effort signals never silently affect your readiness — they're flagged wherever they appear.
      </div>
    </AppShell>
  );
}

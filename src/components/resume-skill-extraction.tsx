import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  X,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Circle,
  Info,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  extractResumeSkills,
  type ExtractedSkill,
  type ResumeExtraction,
} from "@/lib/resume-extract.functions";
import {
  addClaimedSkills,
  saveResumeMeta,
  pushActivity,
  type SkillCategory,
} from "@/lib/skillbridge-store";

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  technical: "Technical skills",
  concept: "Concepts",
  tool: "Tools & platforms",
  project: "Project skills",
};
const ORDER: SkillCategory[] = ["technical", "concept", "tool", "project"];

const ACCEPT = ".pdf,.docx,.txt,.md";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function ResumeSkillExtraction({
  onConfirmed,
  className,
}: {
  onConfirmed?: (count: number, fileName: string) => void;
  className?: string;
}) {
  const extract = useServerFn(extractResumeSkills);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeExtraction | null>(null);
  const [skills, setSkills] = useState<ExtractedSkill[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("That file is over 8MB — try a smaller export.");
      return;
    }
    setFile(f);
    setResult(null);
    setConfirmed(false);
  };

  const analyse = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const data = await readAsBase64(file);
      const res = await extract({
        data: { fileName: file.name, mimeType: file.type || "application/octet-stream", data },
      });
      setResult(res);
      setSkills(res.skills);
      if (!res.skills.length) toast.info("We couldn't find clear skills — add them manually below.");
    } catch (err) {
      toast.error("Resume analysis failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirm = () => {
    if (!file) return;
    addClaimedSkills(skills.map((s) => ({ name: s.name, category: s.category })));
    saveResumeMeta({
      fileName: file.name,
      sizeKb: Math.round(file.size / 1024),
      uploadedAt: new Date().toISOString(),
      skillCount: skills.length,
      roles: result?.roles,
    });
    pushActivity({
      reason: "Resume imported",
      detail: `${skills.length} skills added as claimed — none verified yet`,
    });
    setConfirmed(true);
    toast.success(`${skills.length} skills added as Claimed`, {
      description: "Now prove them with evidence to turn them Verified.",
    });
    onConfirmed?.(skills.length, file.name);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setSkills([]);
    setConfirmed(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const grouped = ORDER.map((c) => ({ category: c, items: skills.filter((s) => s.category === c) })).filter(
    (g) => g.items.length,
  );

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Start with what you already have</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your resume and we'll identify the skills you've claimed and help you prove them.
        </p>
      </div>

      {/* Upload zone */}
      {!result && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "rounded-3xl border-2 border-dashed bg-muted/30 p-8 text-center transition-colors",
            dragging ? "border-primary bg-primary-soft/50" : "border-border",
          )}
        >
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </span>
          <p className="mt-4 text-sm font-medium">
            {loading
              ? "Reading your resume and extracting claimed skills…"
              : file
                ? file.name
                : "Drag and drop your resume here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PDF or DOCX · stays private to your profile</p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              <FileText className="mr-1.5 h-4 w-4" /> Choose file
            </Button>
            <Button type="button" className="rounded-full" disabled={!file || loading} onClick={analyse}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analysing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Upload &amp; analyse
                </>
              )}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      )}

      {/* Review */}
      {result && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-primary-soft/40 p-4 text-sm">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-semibold">Your resume tells us what you claim to know. Your evidence
                proves what you can do.</span>{" "}
                Everything below enters as <strong>Claimed</strong> — nothing is verified by AI alone.
              </span>
            </p>
          </div>

          <div className="rounded-3xl border border-border/60 bg-card/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold">Detected from your resume</h3>
              <span className="text-xs text-muted-foreground">{skills.length} skills · editable</span>
            </div>

            {grouped.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                No skills detected yet — add them manually below.
              </p>
            )}

            <div className="mt-4 space-y-5">
              {grouped.map((g) => (
                <div key={g.category}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABEL[g.category]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {g.items.map((s) => (
                      <span
                        key={s.name}
                        title={s.evidenceHint}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                      >
                        {s.name}
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <Circle className="h-2.5 w-2.5" /> Claimed
                        </span>
                        {!confirmed && (
                          <button
                            type="button"
                            aria-label={`Remove ${s.name}`}
                            onClick={() => setSkills((prev) => prev.filter((x) => x.name !== s.name))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {!confirmed && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add a missing skill (e.g. Kubernetes)"
                  maxLength={60}
                  className="max-w-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const name = newSkill.trim();
                      if (!name) return;
                      if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
                      setSkills((p) => [...p, { name, category: "technical", evidenceHint: "Added by you" }]);
                      setNewSkill("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const name = newSkill.trim();
                    if (!name) return;
                    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
                      toast.info("That skill is already in the list.");
                      return;
                    }
                    setSkills((p) => [...p, { name, category: "technical", evidenceHint: "Added by you" }]);
                    setNewSkill("");
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
            )}
          </div>

          {/* Role suggestions */}
          {!!result.roles.length && (
            <div className="rounded-3xl border border-border/60 bg-card/80 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold">Possible career paths</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <Info className="h-3 w-3" /> Suggestions, not guarantees
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {result.roles.map((r) => (
                  <li key={r.role}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.role}</span>
                      <span className="tabular-nums text-muted-foreground">{r.match}% match</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full gradient-brand" style={{ width: `${r.match}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" className="rounded-full" onClick={reset}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Discard &amp; upload another
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={confirmed || !skills.length}
              onClick={confirm}
            >
              {confirmed ? "Added to your skill inventory" : `Confirm ${skills.length} claimed skills`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

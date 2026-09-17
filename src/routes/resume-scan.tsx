import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ResumeSkillExtraction } from "@/components/resume-skill-extraction";
import { SkillInventory } from "@/components/skill-inventory";
import {
  getResumeMeta,
  clearResumeMeta,
  removeResumeSkills,
  getSkills,
  pushActivity,
  type ResumeMeta,
  type Skill,
} from "@/lib/skillbridge-store";

export const Route = createFileRoute("/resume-scan")({
  head: () => ({
    meta: [
      { title: "AI Resume Skill Extraction — SkillBridge AI" },
      {
        name: "description",
        content:
          "Upload your resume and let AI list the skills you claim. Everything enters as Claimed until evidence proves it.",
      },
      { property: "og:title", content: "AI Resume Skill Extraction — SkillBridge AI" },
      {
        property: "og:description",
        content: "Your resume tells us what you claim to know. Your evidence proves what you can do.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResumeScanPage,
});

function ResumeScanPage() {
  const [meta, setMeta] = useState<ResumeMeta | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    setMeta(getResumeMeta());
    setSkills(getSkills());
  }, []);

  const refresh = () => {
    setMeta(getResumeMeta());
    setSkills(getSkills());
  };

  const remove = () => {
    const kept = removeResumeSkills();
    clearResumeMeta();
    pushActivity({ reason: "Resume removed", detail: "Claimed resume skills were deleted" });
    setSkills(kept);
    setMeta(null);
    toast.success("Resume and its claimed skills were removed.");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">AI Resume Skill Extraction</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Your resume tells us what you claim to know. Your evidence proves what you can do.
        </p>

        {meta && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <p className="font-medium">{meta.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {meta.sizeKb} KB · {meta.skillCount} claimed skills · uploaded{" "}
                {new Date(meta.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto rounded-full" onClick={remove}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete resume
            </Button>
          </div>
        )}

        <div className="mt-8">
          <ResumeSkillExtraction onConfirmed={refresh} />
        </div>

        <div className="mt-10">
          <SkillInventory skills={skills} />
        </div>
      </div>
    </AppShell>
  );
}

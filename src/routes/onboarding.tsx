import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResumeSkillExtraction } from "@/components/resume-skill-extraction";
import { saveStudent } from "@/lib/skillbridge-store";
import { saveOnboardingProfile } from "@/lib/supabase/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — SkillBridge AI" },
      { name: "description", content: "Set up your SkillBridge AI profile in under a minute." },
    ],
  }),
  component: Onboarding,
});

const ROLES = [
  "Software Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "Product Manager",
  "UX Designer",
  "DevOps / SRE",
  "Frontend Engineer",
  "Backend Engineer",
];

const YEARS = ["First year", "Second year", "Third year", "Fourth year", "Recent grad"];

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>("");
  const [roleChoice, setRoleChoice] = useState<string>("");
  const [customRole, setCustomRole] = useState("");
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 1 && year && (roleChoice || customRole.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const targetRole = customRole.trim() || roleChoice;

      await saveOnboardingProfile({
        name: name.trim(),
        educationLevel: year,
        currentJobRole: targetRole,
        targetRole,
      });

      saveStudent({
        name: name.trim(),
        yearOfStudy: year,
        targetRole,
        resumeFileName: resumeName ?? undefined,
        createdAt: new Date().toISOString(),
      });

      toast.success("You're all set", { description: `Welcome, ${name.split(" ")[0]}.` });
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't save your profile. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            SkillBridge <span className="text-primary">AI</span>
          </span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          Back
        </Link>
      </header>

      <div className="mx-auto max-w-2xl px-6 pb-16 pt-4">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Let's set you up</h1>
          <p className="mt-2 text-muted-foreground">
            A minute now saves months later. You can change anything anytime.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-8 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur sm:p-8"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label>Current year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Where are you in your studies?" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target role</Label>
              <Select value={roleChoice} onValueChange={setRoleChoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick the closest match" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="pt-1">
                <Input
                  placeholder="…or type your own (e.g. Robotics Engineer)"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  maxLength={80}
                />
              </div>
              <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Not sure yet? Pick something close — you can change your target role anytime.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Resume (optional)</Label>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <ResumeSkillExtraction
                  onConfirmed={(count, fileName) => {
                    setResumeName(fileName);
                    toast.success(`${count} claimed skills saved to your profile.`);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Your data stays on this device for the prototype.
            </p>
            <Button
              type="submit"
              size="lg"
              className="h-11 rounded-full px-6"
              disabled={!canSubmit || submitting}
            >
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

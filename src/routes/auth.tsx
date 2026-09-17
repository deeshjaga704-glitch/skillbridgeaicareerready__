import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/supabase/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SkillBridge AI" },
      {
        name: "description",
        content: "Sign in or create your SkillBridge AI account.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
  if (mode === "signup") {
    const { data, error } = await signUp(email.trim(), password);

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Account could not be created.");
    }

    toast.success("Account created!");
    navigate({ to: "/onboarding" });
  } else {
    const { error } = await signIn(email.trim(), password);

    if (error) {
      throw error;
    }

    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  }
} catch (error) {
  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";

  toast.error(message);
} finally {
  setLoading(false);
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

        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </Link>
      </header>

      <main className="mx-auto max-w-md px-6 pb-16 pt-12">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-muted-foreground">
            {mode === "signup"
              ? "Your personalized career journey starts here."
              : "Continue your SkillBridge AI journey."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur sm:p-8"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>

              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-full"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signup"
            ? "Already have an account?"
            : "Don't have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() =>
              setMode((current) =>
                current === "signup" ? "signin" : "signup",
              )
            }
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </div>
      </main>
    </div>
  );
}

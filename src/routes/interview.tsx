import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Bot, User, RefreshCw, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askMentor } from "@/lib/mentor.functions";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Mock interview — SkillBridge AI" },
      {
        name: "description",
        content: "Practise answering questions about your own verified projects and get plain-language feedback.",
      },
      { property: "og:title", content: "Mock interview — SkillBridge AI" },
      { property: "og:description", content: "A low-pressure interview rehearsal built around your real evidence." },
    ],
  }),
  component: InterviewPage,
});

type Msg = { id: string; from: "coach" | "you"; text: string; feedback?: string[] };

function InterviewPage() {
  const ask = useServerFn(askMentor);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: "intro",
        from: "coach",
        text: "Hi! I’m your evidence-aware career mentor. Ask about your target role, skill gaps, or what to practise next.",
      },
    ]);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || loading) return;
    setError(null);
    setDraft("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), from: "you", text }]);
    setLoading(true);
    try {
      const response = await ask({ data: { userMessage: text } });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          from: "coach",
          text: response.message,
          feedback: [
            ...response.suggestedActions.map((action) => `Next action: ${action}`),
            ...response.referencedEvidence.map((evidence) => `Evidence: ${evidence}`),
          ],
        },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The mentor could not respond.");
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setError(null);
    setMessages([
      {
        id: "intro",
        from: "coach",
        text: "Hi! I’m your evidence-aware career mentor. Ask about your target role, skill gaps, or what to practise next.",
      },
    ]);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">Mock interview</h1>
          <p className="text-muted-foreground">
            Questions are built from your own verified work, so the practice matches what you'll actually be asked.
          </p>
        </header>

        <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
          {messages.map((m) => (
            <div key={m.id} className={m.from === "you" ? "flex justify-end" : "flex gap-3"}>
              {m.from === "coach" && (
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={
                  m.from === "you"
                    ? "max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground"
                    : "max-w-[80%] rounded-2xl bg-muted px-4 py-2"
                }
              >
                <p className="text-sm">{m.text}</p>
                {m.feedback && (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {m.feedback.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                )}
              </div>
              {m.from === "you" && (
                <span className="ml-2 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your answer the way you'd say it out loud…"
            rows={4}
            className="rounded-2xl"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void send()} disabled={loading} className="rounded-full">
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Send answer
            </Button>
            <Button variant="secondary" onClick={restart} className="rounded-full">
              <RefreshCw className="mr-1 h-4 w-4" /> Start over
            </Button>
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/jobs">Go to job matches</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

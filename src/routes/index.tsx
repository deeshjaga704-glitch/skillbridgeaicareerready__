import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Send,
  Sparkles,
  FileCode2,
  ScanSearch,
  FlaskConical,
  FileCheck2,
  BadgeCheck,
  Github,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TITLE = "SkillBridge AI | Verified Career Readiness for Students";
const DESC =
  "Turn claimed skills into verified ones. SkillBridge AI analyses your projects, builds an evidence-backed resume, and gives you a readiness score employers can actually check.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://skillbridgeaicareerready.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  { icon: FileCode2, title: "Claim a skill", desc: "Say what you think you know." },
  { icon: Github, title: "Submit a project", desc: "A repo, an upload, or an in-platform build." },
  { icon: ScanSearch, title: "Analyse the code", desc: "Commit history, originality, structure." },
  { icon: FlaskConical, title: "Run tests & checks", desc: "Tests, style, and a short live check." },
  { icon: FileCheck2, title: "Generate evidence", desc: "A report anyone can open and read." },
  { icon: BadgeCheck, title: "Verify the skill", desc: "With a level, confidence, and a date." },
];

const FACTORS = [
  { label: "Technical skills", pts: "up to 30", why: "Skills verified with real evidence" },
  { label: "Project evidence", pts: "up to 25", why: "Projects analysed end to end" },
  { label: "Problem solving", pts: "up to 20", why: "Assessment scores for correctness and design" },
  { label: "Testing & quality", pts: "up to 15", why: "Tests passing, docs, code health" },
  { label: "Job-role match", pts: "up to 10", why: "Core requirements for your target role" },
];

const FAQ = [
  {
    q: "What is SkillBridge AI?",
    a: "A career readiness platform for students. It follows you from first year to your first job and proves your skills with evidence instead of resume claims.",
  },
  {
    q: "How are skills verified?",
    a: "You claim a skill, then submit a project. We analyse the code and commit history, run tests and originality checks, and generate an evidence report with a level, confidence range, and date. Live-coding checks, oral walkthroughs, and instructor sign-off carry the same weight.",
  },
  {
    q: "What is a readiness score?",
    a: "A range, never a single number. It is built from technical skills, project evidence, problem solving, testing and quality, and how well you match your target role. Every point is traceable to a piece of evidence.",
  },
  {
    q: "How are projects assessed?",
    a: "Each project is scored across dimensions like correctness, readability, testing, and originality, and is stored as an evidence record showing technologies, tests, documentation, difficulty, and readiness impact.",
  },
  {
    q: "Can employers see my evidence?",
    a: "Only what you share. Each verified skill has a shareable evidence report link, and you control employer visibility in Settings.",
  },
  {
    q: "How is SkillBridge different from LinkedIn?",
    a: "LinkedIn shows what you say about yourself. SkillBridge shows what has been checked — with the projects, tests, and assessments behind every claim.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            SkillBridge <span className="text-primary">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/dashboard">
            <Button variant="ghost" className="rounded-full">
              I already have an account
            </Button>
          </Link>
          <Link to="/onboarding">
            <Button className="rounded-full">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-8 sm:pt-14">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Evidence first, AI second
          </div>
          <h1 className="mt-6 text-balance font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            The only readiness score{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-teal bg-clip-text text-transparent">
              employers can trust
            </span>
            , because it's earned, not claimed.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Every skill, score, and job match on SkillBridge traces back to a project you actually built —
            with the tests, code review, and evidence report attached.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/onboarding">
              <Button size="lg" className="h-12 rounded-full px-6 text-base">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline" className="h-12 rounded-full px-6 text-base">
                See a sample dashboard
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free while in beta. No credit card. Your work stays yours.
          </p>
        </div>

        {/* Sample verified skill card */}
        <div className="mx-auto mt-16 max-w-3xl">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What "verified" actually looks like
          </p>
          <div className="rounded-3xl border border-border/60 bg-card/80 p-2 shadow-xl shadow-primary/5 backdrop-blur">
            <div className="rounded-2xl bg-gradient-to-br from-primary-soft via-card to-teal-soft p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl font-bold">Python</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/25">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
                <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium">
                  Level: Working
                </span>
                <span className="ml-auto text-xs text-muted-foreground">Verified 12 Jul 2026</span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Evidence items", v: "6" },
                  { k: "Confidence", v: "72–84%" },
                  { k: "Assessment", v: "Passed · 94%" },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{x.k}</div>
                    <div className="font-semibold">{x.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Data-cleaning CLI</span>
                  <span className="text-muted-foreground">24/24 tests passing</span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Course scheduler API</span>
                  <span className="text-muted-foreground">Graded walkthrough</span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Every verified skill opens as a shareable evidence report — no login needed for the recruiter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Verification pipeline */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">How a skill becomes verified</h2>
          <p className="mt-2 text-muted-foreground">
            Six visible steps. Nothing happens in a black box.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {PIPELINE.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <s.icon className="h-4 w-4" />
              </span>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Step {i + 1}
              </div>
              <div className="font-semibold leading-tight">{s.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Score breakdown */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold">Why this score?</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                A readiness score is always shown as a range, and always with the factors behind it.
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary-soft to-teal-soft px-5 py-3 text-center">
              <div className="font-display text-4xl font-extrabold tabular-nums">
                68<span className="text-muted-foreground/60">–</span>79
                <span className="text-xl text-muted-foreground">%</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Sample student</div>
            </div>
          </div>
          <ul className="mt-6 space-y-3">
            {FACTORS.map((f) => (
              <li key={f.label} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{f.label}</span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                    {f.pts} pts
                  </span>
                  <span className="ml-auto text-sm text-muted-foreground">{f.why}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 step */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Verify",
              desc: "Every claimed skill is proven with a real project — we grade the code, not the resume.",
              tint: "primary",
            },
            {
              icon: TrendingUp,
              title: "Track",
              desc: "Watch your readiness score grow as gaps close. See exactly what to learn next.",
              tint: "teal",
            },
            {
              icon: Send,
              title: "Apply",
              desc: "Tailored applications drafted for you. Nothing is sent without your approval.",
              tint: "coral",
            },
          ].map((step, i) => (
            <div
              key={step.title}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="absolute right-4 top-4 font-display text-6xl font-extrabold text-muted/60">
                0{i + 1}
              </div>
              <div
                className={
                  step.tint === "primary"
                    ? "grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary"
                    : step.tint === "teal"
                    ? "grid h-11 w-11 place-items-center rounded-2xl bg-teal-soft text-teal"
                    : "grid h-11 w-11 place-items-center rounded-2xl bg-coral-soft text-coral"
                }
              >
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="text-center font-display text-3xl font-bold">Questions students ask</h2>
        <Accordion type="single" collapsible className="mt-6">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border/60 bg-gradient-to-br from-primary/95 to-primary p-10 text-center text-primary-foreground shadow-xl shadow-primary/20">
          <h2 className="font-display text-3xl font-bold">Ready to earn a score you can prove?</h2>
          <p className="mt-2 text-primary-foreground/80">
            Takes 60 seconds to set up. Your first verified project can happen this week.
          </p>
          <Link to="/onboarding">
            <Button
              size="lg"
              variant="secondary"
              className="mt-6 h-12 rounded-full bg-background px-6 text-base text-foreground hover:bg-background/90"
            >
              Get started <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SkillBridge AI · Verified, not claimed. ·{" "}
        <Link to="/employers" className="underline">For employers</Link>
      </footer>
    </div>
  );
}

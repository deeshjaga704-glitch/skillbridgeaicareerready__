// Evidence chain helpers: Career Goal → Job Requirements → Skill Gaps → Projects →
// Evidence → Verified Skills → Readiness Score → Resume → Job Matching → Approval.
// Prototype data derived from the localStorage store.

import { getRecords, isDecaying, monthsSince, type Skill, type VerificationRecord } from "./skillbridge-store";
import { requirementsForRole } from "./skillbridge-roles";

export type SkillState = "claimed" | "in-review" | "verified" | "needs-evidence";

export const SKILL_STATE_META: Record<
  SkillState,
  { label: string; hint: string; chip: string; dot: string }
> = {
  verified: {
    label: "Verified",
    hint: "Backed by evidence we analysed",
    chip: "bg-success/15 text-success ring-1 ring-success/25",
    dot: "bg-success",
  },
  "in-review": {
    label: "In review",
    hint: "Evidence submitted, checks running",
    chip: "bg-primary-soft text-primary ring-1 ring-primary/25",
    dot: "bg-primary",
  },
  "needs-evidence": {
    label: "Needs more evidence",
    hint: "Signals were too weak or too old",
    chip: "bg-warning/15 text-warning-foreground ring-1 ring-warning/30",
    dot: "bg-warning",
  },
  claimed: {
    label: "Claimed",
    hint: "Self-reported, no proof yet",
    chip: "bg-muted text-muted-foreground ring-1 ring-border",
    dot: "bg-muted-foreground/60",
  },
};

/** Four-state status derived from the stored skill + decay rules. */
export function skillState(s: Skill): SkillState {
  const raw = s.status as string;
  if (raw === "in-review" || raw === "needs-evidence") return raw;
  if (raw === "verified") return isDecaying(s) ? "needs-evidence" : "verified";
  return "claimed";
}

export type SkillLevel = "Foundational" | "Working" | "Proficient";

export function skillLevel(s: Skill): SkillLevel {
  const mid = ((s.confidenceLow ?? 0) + (s.confidenceHigh ?? 0)) / 2;
  if (mid >= 80) return "Proficient";
  if (mid >= 60) return "Working";
  return "Foundational";
}

/** Progress contributes to matching, but never changes the evidence status. */
export function skillMatchScore(skill: Skill, requiredSkill: string): number {
  if (skill.name.toLowerCase() !== requiredSkill.toLowerCase()) return 0;
  if (skillState(skill) === "verified") return 1;
  if (skill.proficiency === undefined || skill.targetProficiency === undefined) return 0;
  if (skill.targetProficiency <= 0) return 0;
  return Math.min(1, Math.max(0, skill.proficiency / skill.targetProficiency));
}

/* ---------------------------------- Projects --------------------------------- */

export type ProjectEvidence = {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  technologies: string[];
  githubUrl: string;
  demoUrl?: string;
  tests: { count: number; passing: number };
  documentation: "none" | "basic" | "thorough";
  difficulty: "Starter" | "Intermediate" | "Advanced";
  readinessImpact: number; // points added to the readiness midpoint
  assessment: { dimension: string; score: number; note: string }[];
  completedAt: string;
};

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export const PROJECT_EVIDENCE: ProjectEvidence[] = [
  {
    id: "p1",
    title: "Data-cleaning CLI",
    summary: "Command-line tool that validates and normalises messy CSV exports.",
    skills: ["Python"],
    technologies: ["Python", "pytest", "Click"],
    githubUrl: "https://github.com/example/data-cleaning-cli",
    tests: { count: 24, passing: 24 },
    documentation: "thorough",
    difficulty: "Intermediate",
    readinessImpact: 7,
    assessment: [
      { dimension: "Correctness", score: 94, note: "All rubric cases pass" },
      { dimension: "Readability", score: 88, note: "Clear functions, typed signatures" },
      { dimension: "Testing", score: 90, note: "24 tests covering edge cases" },
      { dimension: "Originality", score: 92, note: "No match against tutorial repos" },
    ],
    completedAt: ago(30),
  },
  {
    id: "p2",
    title: "Course scheduler API",
    summary: "REST API with a normalised Postgres schema and seeded query benchmarks.",
    skills: ["SQL", "Python"],
    technologies: ["PostgreSQL", "FastAPI", "SQLAlchemy"],
    githubUrl: "https://github.com/example/course-scheduler",
    demoUrl: "https://scheduler.example.dev",
    tests: { count: 11, passing: 10 },
    documentation: "basic",
    difficulty: "Intermediate",
    readinessImpact: 4,
    assessment: [
      { dimension: "Schema design", score: 76, note: "Normalised, a few missing indexes" },
      { dimension: "Query skill", score: 68, note: "Joins fine, window functions untested" },
      { dimension: "Testing", score: 60, note: "1 failing test at submission" },
    ],
    completedAt: ago(210),
  },
  {
    id: "p3",
    title: "Containerised portfolio",
    summary: "Multi-stage Dockerfile plus CI pipeline for a personal site.",
    skills: ["Docker", "Git & GitHub"],
    technologies: ["Docker", "GitHub Actions", "Nginx"],
    githubUrl: "https://github.com/example/portfolio-docker",
    demoUrl: "https://alex.example.dev",
    tests: { count: 4, passing: 4 },
    documentation: "basic",
    difficulty: "Starter",
    readinessImpact: 5,
    assessment: [
      { dimension: "Build reproducibility", score: 82, note: "Clean multi-stage build" },
      { dimension: "CI quality", score: 74, note: "Lint + build on every push" },
      { dimension: "Originality", score: 61, note: "Resembles a common base template" },
    ],
    completedAt: ago(95),
  },
];

export function projectsForSkill(skillName: string) {
  return PROJECT_EVIDENCE.filter((p) =>
    p.skills.some((s) => s.toLowerCase() === skillName.toLowerCase()),
  );
}

/* --------------------------------- Reports ---------------------------------- */

export type EvidenceReport = {
  skill: Skill;
  record?: VerificationRecord;
  level: SkillLevel;
  state: SkillState;
  projects: ProjectEvidence[];
  capabilities: string[];
  verifiedAt?: string;
};

const CAPABILITIES: Record<string, string[]> = {
  python: ["Writes testable, typed functions", "Handles file I/O and edge cases", "Uses pytest for regression cover"],
  sql: ["Designs normalised schemas", "Writes multi-table joins", "Reads query plans at a basic level"],
  docker: ["Authors multi-stage Dockerfiles", "Runs services reproducibly", "Wires builds into CI"],
  "git & github": ["Branches and reviews via PRs", "Keeps a readable commit history", "Resolves merge conflicts"],
};

export function buildReport(skill: Skill): EvidenceReport {
  const record = getRecords().find((r) => r.id === skill.verificationRecordId);
  return {
    skill,
    record,
    level: skillLevel(skill),
    state: skillState(skill),
    projects: projectsForSkill(skill.name),
    capabilities: CAPABILITIES[skill.name.toLowerCase()] ?? [
      "Applied the skill in a graded project",
      "Explained the approach in a walkthrough",
    ],
    verifiedAt: skill.lastVerifiedAt,
  };
}

/* ------------------------------- Score factors ------------------------------- */

export type ScoreFactor = { label: string; value: number; max: number; why: string };

export function scoreFactors(skills: Skill[], role?: string): ScoreFactor[] {
  const reqs = requirementsForRole(role);
  const verified = skills.filter((s) => skillState(s) === "verified");
  const core = reqs.filter((r) => r.importance === "core");
  const coreMatch = core.reduce(
    (total, requirement) =>
      total + Math.max(
        ...skills.map((skill) => skillMatchScore(skill, requirement.skill)),
        0,
      ),
    0,
  );
  const tests = PROJECT_EVIDENCE.reduce((a, p) => a + p.tests.passing, 0);
  const testTotal = PROJECT_EVIDENCE.reduce((a, p) => a + p.tests.count, 0) || 1;
  return [
    {
      label: "Technical skills",
      value: Math.min(30, verified.length * 8),
      max: 30,
      why: `${verified.length} skills verified with evidence`,
    },
    {
      label: "Project evidence",
      value: Math.min(25, PROJECT_EVIDENCE.length * 8),
      max: 25,
      why: `${PROJECT_EVIDENCE.length} projects analysed`,
    },
    {
      label: "Problem solving",
      value: 15,
      max: 20,
      why: "Assessment scores across correctness and design",
    },
    {
      label: "Testing & quality",
      value: Math.round((tests / testTotal) * 15),
      max: 15,
      why: `${tests}/${testTotal} tests passing across your projects`,
    },
    {
      label: "Job-role match",
      value: core.length ? Math.round((coreMatch / core.length) * 10) : 0,
      max: 10,
      why: `${Math.round((coreMatch / (core.length || 1)) * 100)}% progress across ${core.length} core requirements for your target role`,
    },
  ];
}

/* --------------------------- Role readiness + actions ------------------------- */

export function roleReadiness(skills: Skill[], role?: string) {
  const reqs = requirementsForRole(role);
  const matchScores = reqs.map((requirement) =>
    Math.max(
      ...skills.map((skill) => skillMatchScore(skill, requirement.skill)),
      0,
    ),
  );
  const missing = reqs.filter((_, index) => matchScores[index] === 0);
  const weight = (r: { importance: string }) => (r.importance === "core" ? 2 : 1);
  const total = reqs.reduce((a, r) => a + weight(r), 0);
  const got = reqs.reduce(
    (totalScore, requirement, index) => totalScore + matchScores[index] * weight(requirement),
    0,
  );
  const pct = Math.round((got / total) * 100);
  return { reqs, missing, pct, low: Math.max(0, pct - 6), high: Math.min(100, pct + 5) };
}

export type NextAction = {
  id: string;
  title: string;
  missingSkill: string;
  jobRequirement: string;
  project: string;
  impact: number; // expected readiness points
  difficulty: "Starter" | "Intermediate" | "Advanced";
  score: number; // ranking score
};

export function rankedActions(skills: Skill[], role?: string): NextAction[] {
  const { missing } = roleReadiness(skills, role);
  const claimedNames = new Set(skills.filter((s) => skillState(s) !== "verified").map((s) => s.name.toLowerCase()));
  return missing
    .map((r, i) => {
      const relevance = r.importance === "core" ? 3 : 1.5;
      const gap = claimedNames.has(r.skill.toLowerCase()) ? 1.5 : 2; // claimed = smaller gap
      const difficulty: NextAction["difficulty"] =
        r.importance === "core" ? "Intermediate" : i % 2 === 0 ? "Starter" : "Advanced";
      const diffPenalty = difficulty === "Starter" ? 0 : difficulty === "Intermediate" ? 0.5 : 1.2;
      const impact = Math.round(relevance * gap * 1.6);
      return {
        id: `a-${r.skill}`,
        title: `Verify ${r.skill}`,
        missingSkill: r.skill,
        jobRequirement: r.why,
        project:
          r.resources.find((x) => x.kind === "project")?.label ??
          r.resources[0]?.label ??
          `Build something small using ${r.skill}`,
        impact,
        difficulty,
        score: relevance * gap - diffPenalty,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/* -------------------------------- Job matching -------------------------------- */

export function explainMatch(requires: string[], skills: Skill[]) {
  const verified = new Set(skills.filter((s) => skillState(s) === "verified").map((s) => s.name.toLowerCase()));
  const claimed = new Set(skills.filter((s) => skillState(s) !== "verified").map((s) => s.name.toLowerCase()));
  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];
  let score = 0;
  for (const r of requires) {
    const k = r.toLowerCase();
    if (verified.has(k)) {
      score += 1;
      matched.push(r);
    } else if (claimed.has(k)) {
      score += 0.4;
      partial.push(r);
    } else missing.push(r);
  }
  const pct = Math.round((score / requires.length) * 100);
  return {
    pct,
    low: Math.max(0, pct - 7),
    high: Math.min(100, pct + 6),
    matched,
    partial,
    missing,
    formula: `${matched.length} verified × 1.0 + ${partial.length} claimed × 0.4 + ${missing.length} missing × 0, divided by ${requires.length} requirements.`,
  };
}

export function freshnessLabel(iso?: string) {
  if (!iso) return "no date";
  const m = monthsSince(iso);
  if (m < 1) return "this month";
  if (m < 6) return `${Math.round(m)} months ago`;
  return `${Math.round(m)} months ago · ageing`;
}

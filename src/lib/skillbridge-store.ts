// Shared mock data + localStorage-backed store for SkillBridge AI prototype.
// This is a client-only prototype; no backend yet.

export type SkillStatus = "verified" | "claimed" | "in-review" | "needs-evidence";

export type SkillCategory = "technical" | "concept" | "tool" | "project";

export type Skill = {
  id: string;
  name: string;
  status: SkillStatus;
  source: "resume" | "manual" | "project";
  category?: SkillCategory | string;
  proficiency?: number;
  targetProficiency?: number;
  evidenceCount?: number;
  lastPracticedAt?: string;
  extractedAt?: string; // ISO — when it entered the inventory
  lastVerifiedAt?: string; // ISO
  confidenceLow?: number;
  confidenceHigh?: number;
  verificationMethod?: VerificationMethod;
  verificationRecordId?: string;
};


export type Student = {
  name: string;
  email?: string;
  yearOfStudy: string;
  targetRole: string;
  resumeFileName?: string;
  createdAt: string;
};

export type ReadinessScore = {
  low: number;
  high: number;
  verifiedProjects: number;
};

export type ReadinessFactor = {
  value: number;
  max: number;
};

const STORAGE_KEY = "skillbridge:student:v1";
const SKILLS_KEY = "skillbridge:skills:v1";
const CONN_KEY = "skillbridge:connections:v2";
const ACTIVITY_KEY = "skillbridge:activity:v1";
const RECORDS_KEY = "skillbridge:records:v1";
const APPEALS_KEY = "skillbridge:appeals:v1";
const HISTORY_KEY = "skillbridge:history:v1";
const SCORE_KEY = "skillbridge:score:v1";
let activeUserId: string | null = null;

export function setActiveUserId(userId: string | null) {
  activeUserId = userId;
}

function storageKey(key: string) {
  return activeUserId ? `skillbridge:user:${activeUserId}:${key}` : key;
}

export type ConnectionId = "github" | "leetcode" | "hackerrank" | "linkedin";
export type ConnectionQuality = "official-api" | "best-effort" | "manual";
export type SyncState = "ok" | "stale" | "unavailable";

export type Connection = {
  id: ConnectionId;
  label: string;
  connected: boolean;
  handle?: string;
  lastSyncedAt?: string;
  note?: string;
  quality: ConnectionQuality;
  syncState?: SyncState;
};

export const DEFAULT_CONNECTIONS: Connection[] = [
  { id: "github", label: "GitHub", connected: false, quality: "official-api", note: "Live public API — repos, commits, READMEs." },
  { id: "leetcode", label: "LeetCode", connected: false, quality: "best-effort", note: "No official API — scraped best-effort signal." },
  { id: "hackerrank", label: "HackerRank", connected: false, quality: "best-effort", note: "No official API — scraped best-effort signal." },
  { id: "linkedin", label: "LinkedIn", connected: false, quality: "manual", note: "Manual paste — LinkedIn doesn't allow imports." },
];

export function getConnections(): Connection[] {
  if (typeof window === "undefined") return DEFAULT_CONNECTIONS;
  try {
    const raw = localStorage.getItem(storageKey(CONN_KEY));
    return raw ? (JSON.parse(raw) as Connection[]) : DEFAULT_CONNECTIONS;
  } catch {
    return DEFAULT_CONNECTIONS;
  }
}
export function saveConnections(c: Connection[]) {
  localStorage.setItem(storageKey(CONN_KEY), JSON.stringify(c));
}

export type ActivityItem = {
  id: string;
  at: string;
  reason: string;
  detail?: string;
};

export function getActivity(): ActivityItem[] {
  if (typeof window === "undefined") return DEFAULT_ACTIVITY;
  try {
    const raw = localStorage.getItem(storageKey(ACTIVITY_KEY));
    return raw ? (JSON.parse(raw) as ActivityItem[]) : DEFAULT_ACTIVITY;
  } catch {
    return DEFAULT_ACTIVITY;
  }
}
export function pushActivity(item: Omit<ActivityItem, "id" | "at">) {
  const list = getActivity();
  const next = [
    { id: crypto.randomUUID(), at: new Date().toISOString(), ...item },
    ...list,
  ].slice(0, 20);
  localStorage.setItem(storageKey(ACTIVITY_KEY), JSON.stringify(next));
  return next;
}

const DEFAULT_ACTIVITY: ActivityItem[] = [
  { id: "a1", at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), reason: "GitHub sync", detail: "3 repos analyzed — added 2 new signals" },
  { id: "a2", at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), reason: "Certificate verified", detail: "Coursera — Python for Everybody" },
  { id: "a3", at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), reason: "Course completed", detail: "Databases 101" },
];

export function getStudent(): Student | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(STORAGE_KEY));
    return raw ? (JSON.parse(raw) as Student) : null;
  } catch {
    return null;
  }
}

export function saveStudent(student: Student) {
  localStorage.setItem(storageKey(STORAGE_KEY), JSON.stringify(student));
}

export function clearStudent() {
  localStorage.removeItem(storageKey(STORAGE_KEY));
  localStorage.removeItem(storageKey(SKILLS_KEY));
}

const now = new Date();
const monthsAgo = (m: number) =>
  new Date(now.getFullYear(), now.getMonth() - m, now.getDate()).toISOString();

// Verification methods & signal types
export type VerificationMethod =
  | "in-platform-project"
  | "github-repo"
  | "live-coding"
  | "oral-walkthrough"
  | "instructor-signoff"
  | "certificate";

export type SignalType =
  | "commit_pattern"
  | "originality_check"
  | "style_consistency"
  | "graded_project"
  | "live_check"
  | "instructor_signoff"
  | "tests"
  | "documentation"
  | "quality"
  | "relevance"
  | "evidence_source";

export type SignalOutcome = "pass" | "warn" | "fail" | "pending";

export type VerificationSignal = {
  type: SignalType;
  label: string;
  outcome: SignalOutcome;
  strength: number; // 0..1
  detail: string;
};

export type VerificationOutcome = "verified" | "partial" | "not_verified";

export type VerificationRecord = {
  id: string;
  token: string; // public share token
  skillId: string;
  skillName: string;
  evidenceUrl?: string;
  studentName: string;
  method: VerificationMethod;
  evidenceSummary: string;
  outcome: VerificationOutcome;
  signals: VerificationSignal[];
  timestamp: string;
  reason: string; // plain-language explanation
  /** Raw analysis output when the evidence was actually inspected. */
  analysis?: {
    source: "github" | "text";
    overall: number;
    repo?: Record<string, unknown>;
    dimensions: { dimension: string; score: number; note: string }[];
    facts: Record<string, string[]>;
    warnings: string[];
  };
};

export const DEFAULT_SKILLS: Skill[] = [
  { id: "s1", name: "Python", status: "verified", source: "project", lastVerifiedAt: monthsAgo(1), confidenceLow: 72, confidenceHigh: 84, verificationMethod: "in-platform-project", verificationRecordId: "r1" },
  { id: "s2", name: "Git & GitHub", status: "verified", source: "project", lastVerifiedAt: monthsAgo(2), confidenceLow: 80, confidenceHigh: 92, verificationMethod: "github-repo", verificationRecordId: "r2" },
  { id: "s3", name: "SQL", status: "verified", source: "project", lastVerifiedAt: monthsAgo(7), confidenceLow: 55, confidenceHigh: 68, verificationMethod: "in-platform-project", verificationRecordId: "r3" },
  { id: "s4", name: "Docker", status: "verified", source: "project", lastVerifiedAt: monthsAgo(3), confidenceLow: 60, confidenceHigh: 74, verificationMethod: "github-repo", verificationRecordId: "r4" },
  { id: "s5", name: "React", status: "claimed", source: "resume" },
  { id: "s6", name: "System Design", status: "claimed", source: "resume" },
  { id: "s7", name: "AWS", status: "claimed", source: "manual" },
  { id: "s8", name: "TypeScript", status: "claimed", source: "resume" },
];

export function getSkills(): Skill[] {
  if (typeof window === "undefined") return DEFAULT_SKILLS;
  try {
    const raw = localStorage.getItem(storageKey(SKILLS_KEY));
    if (!raw) return DEFAULT_SKILLS;
    return JSON.parse(raw) as Skill[];
  } catch {
    return DEFAULT_SKILLS;
  }
}

export function saveSkills(skills: Skill[]) {
  localStorage.setItem(storageKey(SKILLS_KEY), JSON.stringify(skills));
}

// Verification records
const DEFAULT_RECORDS: VerificationRecord[] = [
  {
    id: "r1", token: "py-alex-001", skillId: "s1", skillName: "Python", studentName: "Alex Rivera",
    method: "in-platform-project", outcome: "verified",
    evidenceSummary: "Data-cleaning CLI, graded in-platform (94%)",
    timestamp: monthsAgo(1), reason: "Passed graded in-platform project with strong originality and consistent style.",
    signals: [
      { type: "graded_project", label: "Graded in-platform project", outcome: "pass", strength: 0.95, detail: "Scored 94% on rubric" },
      { type: "originality_check", label: "Code originality", outcome: "pass", strength: 0.9, detail: "No matches against common tutorial repos" },
      { type: "style_consistency", label: "Style consistency", outcome: "pass", strength: 0.8, detail: "Matches your other verified Python work" },
    ],
  },
  {
    id: "r2", token: "git-alex-002", skillId: "s2", skillName: "Git & GitHub", studentName: "Alex Rivera",
    method: "github-repo", outcome: "verified",
    evidenceSummary: "Gradual commits over 3 months across 4 repos",
    timestamp: monthsAgo(2), reason: "Consistent commit history across multiple public repositories.",
    signals: [
      { type: "commit_pattern", label: "Commit pattern", outcome: "pass", strength: 0.85, detail: "Gradual commits over time, not a single dump" },
      { type: "originality_check", label: "Code originality", outcome: "pass", strength: 0.8, detail: "Original work — no fork-only history" },
    ],
  },
  {
    id: "r3", token: "sql-alex-003", skillId: "s3", skillName: "SQL", studentName: "Alex Rivera",
    method: "in-platform-project", outcome: "partial",
    evidenceSummary: "Query challenge partially completed 7 months ago",
    timestamp: monthsAgo(7), reason: "Older evidence — signal is decaying. Refresh with a new proof project.",
    signals: [
      { type: "graded_project", label: "Graded in-platform project", outcome: "warn", strength: 0.5, detail: "Older than 6 months — decay applied" },
      { type: "style_consistency", label: "Style consistency", outcome: "pass", strength: 0.7, detail: "Consistent naming and indentation" },
    ],
  },
  {
    id: "r4", token: "dk-alex-004", skillId: "s4", skillName: "Docker", studentName: "Alex Rivera",
    method: "github-repo", outcome: "verified",
    evidenceSummary: "Multi-stage Dockerfile in public repo",
    timestamp: monthsAgo(3), reason: "Working Dockerfile and CI configuration found in personal project.",
    signals: [
      { type: "commit_pattern", label: "Commit pattern", outcome: "pass", strength: 0.7, detail: "Iterative commits refining the Dockerfile" },
      { type: "originality_check", label: "Code originality", outcome: "warn", strength: 0.6, detail: "Resembles a common base template" },
    ],
  },
];

export function getRecords(): VerificationRecord[] {
  if (typeof window === "undefined") return DEFAULT_RECORDS;
  try {
    const raw = localStorage.getItem(storageKey(RECORDS_KEY));
    return raw ? (JSON.parse(raw) as VerificationRecord[]) : DEFAULT_RECORDS;
  } catch {
    return DEFAULT_RECORDS;
  }
}
export function saveRecords(r: VerificationRecord[]) {
  localStorage.setItem(storageKey(RECORDS_KEY), JSON.stringify(r));
}
export function getRecordByToken(token: string): VerificationRecord | null {
  return getRecords().find((r) => r.token === token) ?? null;
}
export function upsertRecord(rec: VerificationRecord) {
  const list = getRecords();
  const idx = list.findIndex((r) => r.id === rec.id);
  if (idx >= 0) list[idx] = rec;
  else list.unshift(rec);
  saveRecords(list);
}

// Appeals
export type AppealStatus = "pending" | "upheld" | "overturned";
export type Appeal = {
  id: string;
  skillId: string;
  skillName: string;
  originalOutcome: VerificationOutcome | "not_verified";
  reason: string;
  evidenceUrl?: string;
  status: AppealStatus;
  submittedAt: string;
  reviewedAt?: string;
};

export function getAppeals(): Appeal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(APPEALS_KEY));
    return raw ? (JSON.parse(raw) as Appeal[]) : [];
  } catch {
    return [];
  }
}
export function saveAppeals(a: Appeal[]) {
  localStorage.setItem(storageKey(APPEALS_KEY), JSON.stringify(a));
}
export function submitAppeal(a: Omit<Appeal, "id" | "status" | "submittedAt">) {
  const list = getAppeals();
  const next: Appeal = { ...a, id: crypto.randomUUID(), status: "pending", submittedAt: new Date().toISOString() };
  const updated = [next, ...list];
  saveAppeals(updated);
  return next;
}

// Score history with smoothing
export type ScoreSnapshot = {
  at: string;
  low: number;
  high: number;
  triggerReason: string;
  delta: number; // vs previous midpoint
};

export function getScoreHistory(): ScoreSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(HISTORY_KEY));
    return raw ? (JSON.parse(raw) as ScoreSnapshot[]) : [];
  } catch {
    return [];
  }
}
export function saveScoreHistory(h: ScoreSnapshot[]) {
  localStorage.setItem(storageKey(HISTORY_KEY), JSON.stringify(h));
}

export function getSmoothedScore(): { low: number; high: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(SCORE_KEY));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveSmoothedScore(s: { low: number; high: number }) {
  localStorage.setItem(storageKey(SCORE_KEY), JSON.stringify(s));
}

/**
 * Compute the raw readiness range from skills. Score smoothing is applied
 * separately in the UI so a new signal shifts the number gradually.
 */
export function computeReadiness(
  skills: Skill[],
  factors?: ReadinessFactor[],
): ReadinessScore {
  if (factors) {
    const score = factors.reduce((total, factor) => total + factor.value, 0);
    return {
      low: Math.max(0, Math.round(score) - 6),
      high: Math.min(100, Math.round(score) + 5),
      verifiedProjects: skills.filter((s) => s.status === "verified").length,
    };
  }

  const verified = skills.filter((s) => s.status === "verified");
  const base = Math.min(85, 40 + verified.length * 7);
  return {
    low: Math.max(0, base - 6),
    high: Math.min(100, base + 5),
    verifiedProjects: verified.length,
  };
}

export function isDecaying(skill: Skill): boolean {
  if (!skill.lastVerifiedAt) return false;
  const months = (Date.now() - new Date(skill.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months >= 6;
}

export function monthsSince(iso?: string): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30);
}

/* ------------------------- Resume upload + extraction ------------------------- */

const RESUME_KEY = "skillbridge:resume:v1";

export type ResumeMeta = {
  fileName: string;
  sizeKb: number;
  uploadedAt: string;
  skillCount: number;
  roles?: { role: string; match: number; why: string }[];
};

export function getResumeMeta(): ResumeMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(RESUME_KEY));
    return raw ? (JSON.parse(raw) as ResumeMeta) : null;
  } catch {
    return null;
  }
}
export function saveResumeMeta(m: ResumeMeta) {
  localStorage.setItem(storageKey(RESUME_KEY), JSON.stringify(m));
}
export function clearResumeMeta() {
  localStorage.removeItem(storageKey(RESUME_KEY));
}

/** Remove every skill that came from a resume import (used when deleting a resume). */
export function removeResumeSkills() {
  const kept = getSkills().filter((s) => !(s.source === "resume" && s.status === "claimed"));
  saveSkills(kept);
  return kept;
}

/**
 * Add resume-extracted skills to the inventory. They ALWAYS enter as "claimed" —
 * AI extraction can never produce a verified skill. Existing skills are untouched.
 */
export function addClaimedSkills(
  items: { name: string; category?: SkillCategory }[],
  source: Skill["source"] = "resume",
): Skill[] {
  const existing = getSkills();
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  const added: Skill[] = [];
  for (const item of items) {
    const name = item.name.trim();
    if (!name || have.has(name.toLowerCase())) continue;
    have.add(name.toLowerCase());
    added.push({
      id: crypto.randomUUID(),
      name,
      status: "claimed",
      source,
      category: item.category,
      extractedAt: new Date().toISOString(),
    });
  }
  const next = [...existing, ...added];
  saveSkills(next);
  return next;
}

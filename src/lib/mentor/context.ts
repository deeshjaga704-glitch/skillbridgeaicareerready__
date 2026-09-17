import { roleReadiness, scoreFactors, skillState } from "@/lib/skillbridge-evidence";
import type { Skill } from "@/lib/skillbridge-store";
import type { MentorContext } from "@/lib/mentor.functions";

type ServerSupabaseClient = Awaited<
  ReturnType<(typeof import("@/lib/supabase/server"))["createServerSupabaseClient"]>
>;
type MentorRow = Record<string, unknown>;

const MAX_ROADMAP_STEPS = 12;
const MAX_LEARNING_TASKS = 12;
const MAX_MEMORY_ITEMS = 8;
const MAX_MEMORY_CONTENT_LENGTH = 500;

type MentorSkillProgressRow = {
  skill_name: string;
  category: string | null;
  proficiency: number | null;
  target_proficiency: number | null;
  evidence_count: number | null;
  last_practiced_at: string | null;
};

type MentorVerificationRow = {
  skill_name: string;
  outcome: string;
  timestamp: string;
};

export function mapMentorSkillProgress(
  progressRows: MentorSkillProgressRow[],
  studentId: string,
  verificationRows: MentorVerificationRow[] = [],
): Skill[] {
  const verifiedBySkill = new Map<string, string>();
  for (const row of verificationRows) {
    const skillKey = row.skill_name.toLowerCase();
    if (row.outcome === "verified" && !verifiedBySkill.has(skillKey)) {
      verifiedBySkill.set(skillKey, row.timestamp);
    }
  }

  return progressRows.map((row) => {
    const lastVerifiedAt = verifiedBySkill.get(row.skill_name.toLowerCase());
    return {
      id: `${studentId}:${row.skill_name}`,
      name: row.skill_name,
      status: lastVerifiedAt ? "verified" : "needs-evidence",
      source: lastVerifiedAt ? "project" : "manual",
      category: row.category ?? undefined,
      proficiency: row.proficiency ?? undefined,
      targetProficiency: row.target_proficiency ?? undefined,
      evidenceCount: row.evidence_count ?? undefined,
      lastPracticedAt: row.last_practiced_at ?? undefined,
      lastVerifiedAt,
    };
  });
}

function textValue(row: MentorRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function rowId(row: MentorRow, fallback: string): string {
  return textValue(row, "id") ?? fallback;
}

function statusValue(row: MentorRow): string | null {
  return textValue(row, "status", "state");
}

function isOwnedByStudent(row: MentorRow, studentId: string): boolean {
  const owner = textValue(row, "student_id", "studentId", "profile_id", "profileId");
  return owner === null || owner === studentId;
}

function isActiveStatus(row: MentorRow): boolean {
  const status = statusValue(row)?.toLowerCase();
  return row.is_active === true || status === undefined || ["active", "current", "in_progress"].includes(status);
}

export function isOpenStatus(row: MentorRow): boolean {
  const status = statusValue(row)?.toLowerCase();
  return row.completed === false || row.is_complete === false || status === undefined ||
    ["pending", "current", "active", "in_progress", "not_started", "todo"].includes(status);
}

export function boundMentorJourneyData(input: {
  studentId: string;
  roadmaps: MentorRow[];
  roadmapSteps: MentorRow[];
  learningTasks: MentorRow[];
  memory: MentorRow[];
}) {
  const ownedRoadmaps = input.roadmaps.filter((row) => isOwnedByStudent(row, input.studentId));
  const activeRoadmap = ownedRoadmaps.find(isActiveStatus) ?? null;
  const roadmapId = activeRoadmap ? rowId(activeRoadmap, "roadmap") : null;
  const ownedSteps = input.roadmapSteps.filter((row) => isOwnedByStudent(row, input.studentId));
  const ownedTasks = input.learningTasks.filter((row) => isOwnedByStudent(row, input.studentId));
  const ownedMemory = input.memory.filter((row) => isOwnedByStudent(row, input.studentId));

  return {
    roadmap: activeRoadmap ? {
      id: roadmapId!, title: textValue(activeRoadmap, "title", "name"),
      status: statusValue(activeRoadmap), targetRole: textValue(activeRoadmap, "target_role", "targetRole", "role"),
    } : null,
    roadmapSteps: ownedSteps.filter((row) => roadmapId === null || textValue(row, "roadmap_id", "roadmapId") === roadmapId)
      .filter(isOpenStatus).slice(0, MAX_ROADMAP_STEPS).map((row, index) => ({
        id: rowId(row, `step-${index}`), title: textValue(row, "title", "name") ?? "Untitled roadmap step",
        status: statusValue(row), description: textValue(row, "description", "detail", "why"),
      })),
    learningTasks: ownedTasks.filter(isOpenStatus).slice(0, MAX_LEARNING_TASKS).map((row, index) => ({
      id: rowId(row, `task-${index}`), title: textValue(row, "title", "name") ?? "Untitled learning task",
      status: statusValue(row), description: textValue(row, "description", "detail"), completedAt: textValue(row, "completed_at", "completedAt"),
    })),
    completedLearningTasks: ownedTasks.filter((row) => statusValue(row)?.toLowerCase() === "completed").slice(0, MAX_LEARNING_TASKS).map((row, index) => ({
      id: rowId(row, `completed-task-${index}`), title: textValue(row, "title", "name") ?? "Untitled learning task",
      status: statusValue(row), description: textValue(row, "description", "detail"), completedAt: textValue(row, "completed_at", "completedAt"),
    })),
    memory: ownedMemory.sort((a, b) => {
      const aDate = textValue(a, "updated_at", "created_at", "updatedAt", "createdAt") ?? "";
      const bDate = textValue(b, "updated_at", "created_at", "updatedAt", "createdAt") ?? "";
      return bDate.localeCompare(aDate);
    }).slice(0, MAX_MEMORY_ITEMS).map((row, index) => ({
      id: rowId(row, `memory-${index}`),
      content: (textValue(row, "content", "memory", "value", "note") ?? "").slice(0, MAX_MEMORY_CONTENT_LENGTH),
      category: textValue(row, "category", "type"),
    })).filter((item) => item.content.length > 0),
  };
}

export function buildMentorContext(input: {
  profile: MentorContext["profile"];
  careerGoal: string | null;
  skills: Skill[];
  verificationSummaries: MentorContext["verificationSummaries"];
  journey?: ReturnType<typeof boundMentorJourneyData>;
}): MentorContext {
  const role = input.careerGoal ?? input.profile.currentRole ?? undefined;
  const factors = scoreFactors(input.skills, role);
  const readiness = roleReadiness(input.skills, role);
  const total = factors.reduce((sum, factor) => sum + factor.value, 0);
  return {
    profile: input.profile, careerGoal: input.careerGoal,
    skills: input.skills.slice(0, 40).map((skill) => ({
      name: skill.name, category: skill.category ?? null, proficiency: skill.proficiency ?? null,
      targetProficiency: skill.targetProficiency ?? null, evidenceCount: skill.evidenceCount ?? 0,
      lastPracticedAt: skill.lastPracticedAt ?? null, state: skillState(skill),
    })),
    readiness: {
      low: input.skills.length ? Math.max(0, Math.min(100, total - 6)) : 0,
      high: input.skills.length ? Math.min(100, total + 5) : 0,
      roleMatch: readiness.pct, gaps: readiness.missing.slice(0, 8).map((gap) => gap.skill),
    },
    verificationSummaries: input.verificationSummaries.slice(0, 20),
    roadmap: input.journey?.roadmap ?? null, roadmapSteps: input.journey?.roadmapSteps ?? [],
    learningTasks: input.journey?.learningTasks ?? [], completedLearningTasks: input.journey?.completedLearningTasks ?? [],
    memory: input.journey?.memory ?? [],
  };
}

export async function loadMentorContext(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<{ studentId: string; context: MentorContext }> {
  const { data: profile, error: profileError } = await supabase.from("student_profiles")
    .select("id, name, education_level, current_job_role").eq("user_id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Your student profile could not be found.");

  const [{ data: goal, error: goalError }, { data: progress, error: progressError }, { data: records, error: recordsError }, { data: roadmaps, error: roadmapsError }, { data: learningTasks, error: learningTasksError }, { data: memory, error: memoryError }] = await Promise.all([
    supabase.from("career_goals").select("target_role").eq("student_id", profile.id).eq("status", "active").maybeSingle(),
    supabase.from("skill_progress").select("skill_name, category, proficiency, target_proficiency, evidence_count, last_practiced_at").eq("student_id", profile.id),
    supabase.from("verification_records").select("skill_name, outcome, method, evidence_summary, reason, timestamp").eq("student_id", profile.id).order("timestamp", { ascending: false }).limit(20),
    supabase.from("roadmaps").select("*").eq("student_id", profile.id),
    supabase.from("learning_tasks").select("*").eq("student_id", profile.id),
    supabase.from("mentor_memory").select("*").eq("student_id", profile.id),
  ]);
  if (goalError) throw goalError;
  if (progressError) throw progressError;
  if (recordsError) throw recordsError;
  if (roadmapsError) throw roadmapsError;
  if (learningTasksError) throw learningTasksError;
  if (memoryError) throw memoryError;

  const roadmapRows = (roadmaps ?? []) as MentorRow[];
  const activeRoadmap = boundMentorJourneyData({ studentId: profile.id, roadmaps: roadmapRows, roadmapSteps: [], learningTasks: [], memory: [] }).roadmap;
  const { data: roadmapSteps, error: roadmapStepsError } = activeRoadmap
    ? await supabase.from("roadmap_steps").select("*").eq("roadmap_id", activeRoadmap.id)
    : { data: [], error: null };
  if (roadmapStepsError) throw roadmapStepsError;

  const skills = mapMentorSkillProgress(
    (progress ?? []) as MentorSkillProgressRow[],
    profile.id,
    (records ?? []) as MentorVerificationRow[],
  );
  const journey = boundMentorJourneyData({ studentId: profile.id, roadmaps: roadmapRows, roadmapSteps: (roadmapSteps ?? []) as MentorRow[], learningTasks: (learningTasks ?? []) as MentorRow[], memory: (memory ?? []) as MentorRow[] });
  return {
    studentId: profile.id,
    context: buildMentorContext({
      profile: { name: profile.name, education: profile.education_level, currentRole: profile.current_job_role },
      careerGoal: goal?.target_role ?? null, skills,
      verificationSummaries: (records ?? []).map((record) => ({ skillName: record.skill_name, outcome: record.outcome, method: record.method, summary: record.evidence_summary, reason: record.reason })),
      journey,
    }),
  };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildSteps, type RoadmapStepDefinition } from "@/lib/roadmap-generator";
import type { Skill } from "@/lib/skillbridge-store";

type ServerSupabaseClient = Awaited<
  ReturnType<(typeof import("@/lib/supabase/server"))["createServerSupabaseClient"]>
>;

type RoadmapRow = {
  id: string;
  student_id: string;
  career_goal_id: string | null;
  title: string;
  description: string | null;
  status: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
};

export type PersistedRoadmapStep = {
  id: string;
  appId: string;
  roadmap_id: string;
  title: string;
  description: string | null;
  skill_category: string | null;
  step_order: number;
  status: string;
  progress_percentage: number;
  completed: boolean;
};

export type PersistedRoadmap = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progressPercentage: number;
  steps: PersistedRoadmapStep[];
};

const InitializeInput = z.object({
  completedStepIds: z.array(z.string().min(1).max(100)).max(100),
}).strict();

const UpdateStepInput = z.object({
  stepId: z.string().uuid(),
  completed: z.boolean(),
}).strict();

const roadmapInitializationLocks = new Map<string, Promise<void>>();

export function progressFromSteps(steps: Array<{ progress_percentage: number }>): number {
  if (!steps.length) return 0;
  return Math.round(steps.reduce((total, step) => total + step.progress_percentage, 0) / steps.length);
}

export async function withRoadmapInitializationLock<T>(studentId: string, operation: () => Promise<T>): Promise<T> {
  const previous = roadmapInitializationLocks.get(studentId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  roadmapInitializationLocks.set(studentId, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (roadmapInitializationLocks.get(studentId) === queued) roadmapInitializationLocks.delete(studentId);
  }
}

function roadmapDiagnosticError(stage: string, error: unknown): Error {
  if (!error || typeof error !== "object") return new Error(`[roadmap:${stage}] ${String(error)}`);
  const value = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const metadata = [
    typeof value.code === "string" ? `code=${value.code}` : null,
    typeof value.message === "string" ? `message=${value.message}` : null,
    typeof value.details === "string" ? `details=${value.details}` : null,
    typeof value.hint === "string" ? `hint=${value.hint}` : null,
  ].filter(Boolean).join(" ");
  return new Error(`[roadmap:${stage}] ${metadata || "Unknown server error"}`);
}

function toSkillRows(rows: Array<Record<string, unknown>>, studentId: string): Skill[] {
  return rows.map((row) => ({
    id: `${studentId}:${row.skill_name}`,
    name: row.skill_name as string,
    status: "needs-evidence",
    source: "manual",
    category: (row.category as string | null) ?? undefined,
    proficiency: (row.proficiency as number | null) ?? undefined,
    targetProficiency: (row.target_proficiency as number | null) ?? undefined,
    evidenceCount: (row.evidence_count as number | null) ?? undefined,
    lastPracticedAt: (row.last_practiced_at as string | null) ?? undefined,
  }));
}

function mapSteps(rows: Array<Record<string, unknown>>, definitions: RoadmapStepDefinition[]): PersistedRoadmapStep[] {
  return rows
    .slice()
    .sort((a, b) => Number(a.step_order ?? 0) - Number(b.step_order ?? 0))
    .map((row, index) => ({
      id: row.id as string,
      appId: definitions[index]?.id ?? `step-${index}`,
      roadmap_id: row.roadmap_id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      skill_category: (row.skill_category as string | null) ?? null,
      step_order: Number(row.step_order ?? index + 1),
      status: row.status as string,
      progress_percentage: Number(row.progress_percentage ?? 0),
      completed: row.status === "completed" || Number(row.progress_percentage ?? 0) >= 100,
    }));
}

async function getContext(supabase: ServerSupabaseClient) {
  const { getServerAuthenticatedUser } = await import("@/lib/supabase/server");
  const user = await getServerAuthenticatedUser(supabase);
  if (!user) throw new Error("Please sign in before loading your roadmap.");

  const { data: profile, error: profileError } = await supabase
    .from("student_profiles")
    .select("id, current_job_role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("Your student profile could not be found.");

  const [{ data: goal, error: goalError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from("career_goals").select("id, target_role").eq("student_id", profile.id).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("skill_progress").select("skill_name, category, proficiency, target_proficiency, evidence_count, last_practiced_at").eq("student_id", profile.id),
  ]);
  if (goalError) throw goalError;
  if (progressError) throw progressError;

  return {
    profile,
    goal,
    skills: toSkillRows((progress ?? []) as Array<Record<string, unknown>>, profile.id),
    studentId: profile.id,
  };
}

async function serializeRoadmap(
  roadmap: RoadmapRow,
  stepRows: Array<Record<string, unknown>>,
  definitions: RoadmapStepDefinition[],
): Promise<PersistedRoadmap> {
  return {
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description,
    status: roadmap.status,
    progressPercentage: roadmap.progress_percentage,
    steps: mapSteps(stepRows, definitions),
  };
}

async function findOwnedActiveRoadmap(supabase: ServerSupabaseClient, studentId: string): Promise<RoadmapRow | null> {
  const { data, error } = await supabase
    .from("roadmaps")
    .select("id, student_id, career_goal_id, title, description, status, progress_percentage, created_at, updated_at")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RoadmapRow | null;
}

export const loadOrCreateRoadmap = createServerFn({ method: "POST" })
  .validator((input: unknown) => InitializeInput.parse(input))
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    const { profile, goal, skills, studentId } = await getContext(supabase);
    return withRoadmapInitializationLock(studentId, async () => {
      const definitions = buildSteps(skills, goal?.target_role ?? profile.current_job_role ?? undefined);

      let roadmap = await findOwnedActiveRoadmap(supabase, studentId);
      if (!roadmap) {
      const completedIds = new Set(data.completedStepIds);
      const stepRows = definitions.map((definition, index) => ({
        title: definition.title,
        description: definition.detail,
        skill_category: definition.id.startsWith("core-") || definition.id.startsWith("helpful-") ? definition.id.split("-").slice(1).join("-") : "Career foundation",
        step_order: index + 1,
        status: definition.auto || completedIds.has(definition.id) ? "completed" : "pending",
        progress_percentage: definition.auto || completedIds.has(definition.id) ? 100 : 0,
      }));
      const { data: createdRoadmap, error: createError } = await supabase
        .from("roadmaps")
        .insert({
          student_id: studentId,
          career_goal_id: goal?.id ?? null,
          title: "Your Career Roadmap",
          description: goal?.target_role ? `A roadmap toward ${goal.target_role}.` : "Your personalized career roadmap.",
          status: "active",
          progress_percentage: progressFromSteps(stepRows),
        })
        .select("id, student_id, career_goal_id, title, description, status, progress_percentage, created_at, updated_at")
        .single();
      if (createError) throw createError;
      const candidateRoadmap = createdRoadmap as RoadmapRow;
      const authoritativeRoadmap = await findOwnedActiveRoadmap(supabase, studentId);
      if (!authoritativeRoadmap) throw new Error("The roadmap could not be loaded after creation.");
      roadmap = authoritativeRoadmap;

      if (authoritativeRoadmap.id === candidateRoadmap.id) {
        const { error: stepsError } = await supabase.from("roadmap_steps").insert(
          stepRows.map((step) => ({ ...step, roadmap_id: candidateRoadmap.id })),
        );
        if (stepsError) throw stepsError;
      }
      }

      const { data: steps, error: stepsError } = await supabase
        .from("roadmap_steps")
        .select("id, roadmap_id, title, description, skill_category, step_order, status, progress_percentage")
        .eq("roadmap_id", roadmap.id)
        .order("step_order", { ascending: true });
      if (stepsError) throw stepsError;
      return serializeRoadmap(roadmap, (steps ?? []) as Array<Record<string, unknown>>, definitions);
    });
  });

export const updateRoadmapStep = createServerFn({ method: "POST" })
  .validator((input: unknown) => UpdateStepInput.parse(input))
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    try {
      let context: Awaited<ReturnType<typeof getContext>>;
      try {
        context = await getContext(supabase);
      } catch (error) {
        throw roadmapDiagnosticError("authenticate-context", error);
      }
      const { studentId } = context;

      const { data: step, error: stepError } = await supabase.from("roadmap_steps").select("id, roadmap_id").eq("id", data.stepId).maybeSingle();
      if (stepError) throw roadmapDiagnosticError("load-step", stepError);
      if (!step) throw new Error("[roadmap:load-step] Roadmap step not found.");

      const { data: ownedRoadmap, error: ownerError } = await supabase.from("roadmaps").select("id").eq("id", step.roadmap_id).eq("student_id", studentId).maybeSingle();
      if (ownerError) throw roadmapDiagnosticError("verify-ownership", ownerError);
      if (!ownedRoadmap) throw new Error("[roadmap:verify-ownership] Roadmap step does not belong to you.");

      const status = data.completed ? "completed" : "pending";
      const progress = data.completed ? 100 : 0;
      const { data: updatedStep, error: updateError } = await supabase
        .from("roadmap_steps")
        .update({ status, progress_percentage: progress })
        .eq("id", data.stepId)
        .select("id, roadmap_id, title, description, skill_category, step_order, status, progress_percentage")
        .single();
      if (updateError) throw roadmapDiagnosticError("update-step", updateError);

      const { data: allSteps, error: allStepsError } = await supabase.from("roadmap_steps").select("progress_percentage").eq("roadmap_id", step.roadmap_id);
      if (allStepsError) throw roadmapDiagnosticError("load-roadmap-progress", allStepsError);
      const { error: roadmapUpdateError } = await supabase.from("roadmaps").update({ progress_percentage: progressFromSteps((allSteps ?? []) as Array<{ progress_percentage: number }>) }).eq("id", step.roadmap_id).eq("student_id", studentId);
      if (roadmapUpdateError) throw roadmapDiagnosticError("update-roadmap-progress", roadmapUpdateError);
      return updatedStep;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("[roadmap:")) throw error;
      throw roadmapDiagnosticError("unexpected", error);
    }
  });

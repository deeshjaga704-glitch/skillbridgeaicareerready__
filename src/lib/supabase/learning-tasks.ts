import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EmptyInput = z.object({}).strict();
const CompleteInput = z.object({ taskId: z.string().uuid() }).strict();

type ServerSupabaseClient = Awaited<
  ReturnType<(typeof import("@/lib/supabase/server"))["createServerSupabaseClient"]>
>;

export type LearningTask = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
};

export type AuthenticatedLearningTasks = {
  active: LearningTask[];
  completed: LearningTask[];
};

async function getAuthenticatedStudentContext(supabase: ServerSupabaseClient) {
  const { getServerAuthenticatedUser } = await import("@/lib/supabase/server");
  const user = await getServerAuthenticatedUser(supabase);
  if (!user) throw new Error("Please sign in to load your learning tasks.");

  const { data: profile, error } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("Your student profile could not be found.");

  return { studentId: profile.id };
}

function mapLearningTask(row: Record<string, unknown>): LearningTask {
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled learning task"),
    description: typeof row.description === "string" ? row.description : null,
    category: typeof row.category === "string" ? row.category : null,
    difficulty: typeof row.difficulty === "string" ? row.difficulty : null,
    estimatedMinutes: typeof row.estimated_minutes === "number" ? row.estimated_minutes : null,
    dueDate: typeof row.due_date === "string" ? row.due_date : null,
    status: String(row.status ?? "pending"),
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
  };
}

async function updatePracticeProgress(
  supabase: ServerSupabaseClient,
  studentId: string,
  task: Record<string, unknown>,
  completedAt: string,
): Promise<void> {
  const roadmapStepId = task.roadmap_step_id;
  if (typeof roadmapStepId !== "string") return;

  try {
    const { data: roadmapStep, error: roadmapStepError } = await supabase
      .from("roadmap_steps")
      .select("roadmap_id, skill_category")
      .eq("id", roadmapStepId)
      .maybeSingle();
    if (roadmapStepError || !roadmapStep || typeof roadmapStep.roadmap_id !== "string") return;

    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .select("id")
      .eq("id", roadmapStep.roadmap_id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (roadmapError || !roadmap) return;

    const skillName = roadmapStep.skill_category;
    if (typeof skillName !== "string" || !skillName) return;

    const { data: skill, error: skillError } = await supabase
      .from("skill_progress")
      .select("skill_name")
      .eq("student_id", studentId)
      .eq("skill_name", skillName)
      .maybeSingle();
    if (skillError || !skill) return;

    await supabase
      .from("skill_progress")
      .update({ last_practiced_at: completedAt, updated_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("skill_name", skillName);
  } catch {
    // Practice progress is best-effort; task completion must remain successful.
  }
}

export async function completeOwnedLearningTask(
  supabase: ServerSupabaseClient,
  studentId: string,
  taskId: string,
): Promise<LearningTask | null> {
  const { data: task, error: lookupError } = await supabase
    .from("learning_tasks")
    .select("id, title, description, category, difficulty, estimated_minutes, due_date, status, completed_at, roadmap_step_id")
    .eq("id", taskId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!task) return null;

  if (task.status === "completed") return mapLearningTask(task as Record<string, unknown>);

  const completedAt = new Date().toISOString();
  const { data: updatedTask, error: updateError } = await supabase
    .from("learning_tasks")
    .update({ status: "completed", completed_at: completedAt })
    .eq("id", taskId)
    .eq("student_id", studentId)
    .select("id, title, description, category, difficulty, estimated_minutes, due_date, status, completed_at")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedTask) return null;

  const completedTask = updatedTask as Record<string, unknown>;
  if (typeof completedTask.completed_at === "string") {
    await updatePracticeProgress(supabase, studentId, completedTask, completedTask.completed_at);
  }

  return mapLearningTask(completedTask);
}

export const getAuthenticatedLearningTasks = createServerFn({ method: "GET" })
  .validator((input: unknown) => EmptyInput.parse(input))
  .handler(async () => {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    const { studentId } = await getAuthenticatedStudentContext(supabase);
    const { data, error } = await supabase
      .from("learning_tasks")
      .select("id, title, description, category, difficulty, estimated_minutes, due_date, status, completed_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;

    const tasks = ((data ?? []) as Array<Record<string, unknown>>).map(mapLearningTask);
    return {
      active: tasks.filter((task) => task.status.toLowerCase() !== "completed"),
      completed: tasks.filter((task) => task.status.toLowerCase() === "completed"),
    } satisfies AuthenticatedLearningTasks;
  });

export const completeAuthenticatedLearningTask = createServerFn({ method: "POST" })
  .validator((input: unknown) => CompleteInput.parse(input))
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = createServerSupabaseClient();
    const { studentId } = await getAuthenticatedStudentContext(supabase);
    return completeOwnedLearningTask(supabase, studentId, data.taskId);
  });

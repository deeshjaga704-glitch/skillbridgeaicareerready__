import { describe, expect, it, vi } from "vitest";
import { completeOwnedLearningTask } from "@/lib/supabase/learning-tasks";

type TaskRow = Record<string, unknown>;

function mockTaskDatabase(options: {
  tasks: TaskRow[];
  roadmapSteps?: TaskRow[];
  roadmaps?: TaskRow[];
  skills?: TaskRow[];
}) {
  const tables: Record<string, TaskRow[]> = {
    learning_tasks: options.tasks,
    roadmap_steps: options.roadmapSteps ?? [],
    roadmaps: options.roadmaps ?? [],
    skill_progress: options.skills ?? [],
  };
  const state = {
    filters: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
    updates: [] as Array<{ table: string; payload: TaskRow }>,
  };
  const builder = {
    table: "",
    filters: {} as Record<string, unknown>,
    mode: "select" as "select" | "update",
    from(table: string) {
      builder.table = table;
      builder.filters = {};
      builder.mode = "select";
      return builder;
    },
    select() { if (builder.mode !== "update") builder.mode = "select"; return builder; },
    eq(key: string, value: unknown) { builder.filters[key] = value; return builder; },
    update(payload: TaskRow) {
      builder.mode = "update";
      state.updates.push({ table: builder.table, payload });
      return builder;
    },
    maybeSingle: async () => {
      state.filters.push({ table: builder.table, filters: Object.entries(builder.filters) });
      const rows = tables[builder.table] ?? [];
      const task = rows.find((row) =>
        Object.entries(builder.filters).every(([key, value]) => row[key] === value),
      );
      if (builder.mode === "update" && task) {
        Object.assign(task, state.updates.at(-1)?.payload);
      }
      return { data: task ?? null, error: null };
    },
  };
  return { builder, state, tasks: options.tasks, skills: options.skills ?? [] };
}

const taskId = "11111111-1111-4111-8111-111111111111";
const duplicateId = "22222222-2222-4222-8222-222222222222";

function task(id: string, status = "pending", studentId = "student-1", roadmapStepId?: string): TaskRow {
  return {
    id,
    student_id: studentId,
    title: "Practice TypeScript",
    description: "Write a typed utility.",
    category: "technical",
    difficulty: "intermediate",
    estimated_minutes: 30,
    due_date: null,
    status,
    completed_at: status === "completed" ? "2026-09-16T12:00:00.000Z" : null,
    roadmap_step_id: roadmapStepId ?? null,
  };
}

function skill(skillName = "TypeScript"): TaskRow {
  return {
    student_id: "student-1",
    skill_name: skillName,
    proficiency: 60,
    target_proficiency: 100,
    evidence_count: 2,
    last_practiced_at: null,
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

describe("authenticated learning task completion", () => {
  it("completes the exact UUID when active tasks share a title", async () => {
    const database = mockTaskDatabase({ tasks: [task(taskId), task(duplicateId)] });

    const result = await completeOwnedLearningTask(database.builder as never, "student-1", taskId);

    expect(result).toMatchObject({ id: taskId, status: "completed", completedAt: expect.any(String) });
    expect(database.tasks.find((row) => row.id === taskId)?.status).toBe("completed");
    expect(database.tasks.find((row) => row.id === duplicateId)?.status).toBe("pending");
    expect(database.state.updates).toEqual([{ table: "learning_tasks", payload: { status: "completed", completed_at: expect.any(String) } }]);
    expect(database.state.filters).toContainEqual({ table: "learning_tasks", filters: [["id", taskId], ["student_id", "student-1"]] });
  });

  it("does not reveal or mutate a foreign task", async () => {
    const database = mockTaskDatabase({ tasks: [task(taskId, "pending", "student-2")] });

    const result = await completeOwnedLearningTask(database.builder as never, "student-1", taskId);

    expect(result).toBeNull();
    expect(database.state.updates).toEqual([]);
    expect(database.state.filters).toContainEqual({ table: "learning_tasks", filters: [["id", taskId], ["student_id", "student-1"]] });
  });

  it("returns an already completed task without updating it", async () => {
    const database = mockTaskDatabase({ tasks: [task(taskId, "completed")] });

    const result = await completeOwnedLearningTask(database.builder as never, "student-1", taskId);

    expect(result).toMatchObject({ id: taskId, status: "completed", completedAt: "2026-09-16T12:00:00.000Z" });
    expect(database.state.updates).toEqual([]);
  });

  it("updates only practice time for an exactly matched owned roadmap skill", async () => {
    const completedAt = "2026-09-17T12:00:00.000Z";
    const database = mockTaskDatabase({
      tasks: [task(taskId, "pending", "student-1", "step-1")],
      roadmapSteps: [{ id: "step-1", roadmap_id: "roadmap-1", skill_category: "TypeScript" }],
      roadmaps: [{ id: "roadmap-1", student_id: "student-1" }],
      skills: [skill()],
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(completedAt));

    const result = await completeOwnedLearningTask(database.builder as never, "student-1", taskId);

    vi.useRealTimers();
    expect(result?.completedAt).toBe(completedAt);
    expect(database.state.updates).toEqual([
      { table: "learning_tasks", payload: { status: "completed", completed_at: completedAt } },
      { table: "skill_progress", payload: { last_practiced_at: completedAt, updated_at: expect.any(String) } },
    ]);
    expect(database.state.updates.at(-1)?.payload).not.toHaveProperty("proficiency");
    expect(database.state.updates.at(-1)?.payload).not.toHaveProperty("evidence_count");
    expect(database.skills[0]).toMatchObject({
      proficiency: 60,
      target_proficiency: 100,
      evidence_count: 2,
    });
    expect(database.state.updates.some((update) => update.table === "verification_records")).toBe(false);
  });

  it("completes an unassociated task without changing skill progress", async () => {
    const database = mockTaskDatabase({ tasks: [task(taskId)], skills: [skill()] });

    await expect(completeOwnedLearningTask(database.builder as never, "student-1", taskId)).resolves.toMatchObject({
      id: taskId,
      status: "completed",
    });
    expect(database.state.updates).toHaveLength(1);
    expect(database.state.updates.every((update) => update.table !== "skill_progress")).toBe(true);
  });

  it("does not update progress for an unowned roadmap step", async () => {
    const database = mockTaskDatabase({
      tasks: [task(taskId, "pending", "student-1", "step-1")],
      roadmapSteps: [{ id: "step-1", roadmap_id: "roadmap-2", skill_category: "TypeScript" }],
      roadmaps: [{ id: "roadmap-2", student_id: "student-2" }],
      skills: [skill()],
    });

    await completeOwnedLearningTask(database.builder as never, "student-1", taskId);
    expect(database.state.updates).toHaveLength(1);
  });

  it("does not create a skill when the roadmap category has no exact match", async () => {
    const database = mockTaskDatabase({
      tasks: [task(taskId, "pending", "student-1", "step-1")],
      roadmapSteps: [{ id: "step-1", roadmap_id: "roadmap-1", skill_category: "Python" }],
      roadmaps: [{ id: "roadmap-1", student_id: "student-1" }],
      skills: [skill("TypeScript")],
    });

    await completeOwnedLearningTask(database.builder as never, "student-1", taskId);
    expect(database.state.updates).toHaveLength(1);
    expect(database.state.updates.some((update) => update.table === "skill_progress")).toBe(false);
  });

  it("uses only the task ID in the browser completion input contract", () => {
    const browserPayload = { taskId };
    expect(Object.keys(browserPayload)).toEqual(["taskId"]);
    expect(browserPayload).not.toHaveProperty("student_id");
    expect(browserPayload).not.toHaveProperty("profile_id");
    expect(browserPayload).not.toHaveProperty("user_id");
  });
});

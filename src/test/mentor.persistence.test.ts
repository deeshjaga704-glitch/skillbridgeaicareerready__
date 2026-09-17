import { describe, expect, it } from "vitest";
import {
  conversationOwnership,
  getOrCreateOwnedConversation,
  loadOwnedConversationHistory,
  persistMentorMessage,
} from "@/lib/mentor/persistence";
import { loadMentorContext } from "@/lib/mentor/context";

function database(options: {
  conversation?: Record<string, unknown> | null;
  conversations?: Record<string, unknown>[];
  messages?: Record<string, unknown>[];
}) {
  const state = {
    conversations: options.conversations ?? (options.conversation ? [options.conversation] : []),
    messages: options.messages ?? [],
    inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  };
  const builder = {
    table: "",
    filters: {} as Record<string, unknown>,
    from(table: string) { builder.table = table; builder.filters = {}; return builder; },
    select() { return builder; },
    match(values: Record<string, unknown>) { Object.assign(builder.filters, values); return builder; },
    eq(key: string, value: unknown) { builder.filters[key] = value; return builder; },
    limit() { return builder; },
    order() { return builder; },
    insert(payload: Record<string, unknown>) { state.inserts.push({ table: builder.table, payload }); if (builder.table === "mentor_conversations") state.conversations.push({ id: "new-conversation", ...payload }); return builder; },
    maybeSingle: async () => {
      const rows = builder.table === "mentor_conversations" ? state.conversations : [];
      const row = rows.find((candidate) => Object.entries(builder.filters).every(([key, value]) => candidate[key] === value)) ?? null;
      return { data: row, error: null };
    },
    single: async () => ({ data: { id: "new-conversation" }, error: null }),
    then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
      const rows = builder.table === "mentor_messages" ? state.messages : [];
      return Promise.resolve(resolve({ data: rows, error: null }));
    },
  };
  return { builder, state };
}

describe("mentor persistence", () => {
  it("derives conversation ownership from the authenticated student", () => {
    expect(conversationOwnership("student-1")).toEqual({ student_id: "student-1" });
  });

  it("reuses an owned active conversation and creates one when absent", async () => {
    const existing = database({ conversation: { id: "conversation-1", student_id: "student-1", status: "active" } });
    await expect(getOrCreateOwnedConversation(existing.builder as never, "student-1")).resolves.toBe("conversation-1");
    expect(existing.state.inserts).toHaveLength(0);

    const created = database({});
    await expect(getOrCreateOwnedConversation(created.builder as never, "student-1")).resolves.toBe("new-conversation");
    expect(created.state.inserts[0]).toEqual({ table: "mentor_conversations", payload: { student_id: "student-1", status: "active" } });
  });

  it("rejects loading a conversation owned by another student", async () => {
    const db = database({ conversation: { id: "conversation-1", student_id: "student-2", status: "active" } });
    await expect(loadOwnedConversationHistory(db.builder as never, "student-1", "conversation-1")).rejects.toThrow("does not belong");
  });

  it("loads only the latest bounded history in chronological order", async () => {
    const db = database({ conversation: { id: "conversation-1", student_id: "student-1", status: "active" }, messages: Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `Message ${index}`, created_at: `2026-09-01T00:00:0${index}.000Z` })) });
    await expect(loadOwnedConversationHistory(db.builder as never, "student-1", "conversation-1")).resolves.toEqual([
      { role: "user", content: "Message 2" }, { role: "assistant", content: "Message 3" },
      { role: "user", content: "Message 4" }, { role: "assistant", content: "Message 5" },
      { role: "user", content: "Message 6" }, { role: "assistant", content: "Message 7" },
      { role: "user", content: "Message 8" }, { role: "assistant", content: "Message 9" },
    ]);
  });

  it("deduplicates an in-flight retry when a request id is supplied", async () => {
    const db = database({ conversation: { id: "conversation-1", student_id: "student-1", status: "active" } });
    const message = { role: "user" as const, content: "Hello" };
    await Promise.all([
      persistMentorMessage(db.builder as never, "student-1", "conversation-1", message, "turn-1"),
      persistMentorMessage(db.builder as never, "student-1", "conversation-1", message, "turn-1"),
    ]);
    await persistMentorMessage(db.builder as never, "student-1", "conversation-1", message, "turn-1");
    expect(db.state.inserts.filter((entry) => entry.table === "mentor_messages")).toHaveLength(1);
  });
});

describe("mentor context", () => {
  it("assembles authenticated profile-owned data and excludes another student's journey rows", async () => {
    const tables: Record<string, Record<string, unknown>[]> = {
      student_profiles: [{ id: "student-1", user_id: "user-1", name: "Alex", education_level: "Third year", current_job_role: "Student" }],
      career_goals: [{ target_role: "Software Engineer", status: "active" }],
      skill_progress: [{ skill_name: "React", category: "technical", proficiency: 70, target_proficiency: 100, evidence_count: 1, last_practiced_at: null }],
      verification_records: [],
      roadmaps: [{ id: "roadmap-1", student_id: "student-1", title: "Backend path", status: "active" }],
      roadmap_steps: [{ id: "step-1", roadmap_id: "roadmap-1", student_id: "student-1", title: "Practice APIs", status: "pending" }],
      learning_tasks: [{ id: "task-1", student_id: "student-1", title: "Build a route", status: "pending" }, { id: "other-task", student_id: "student-2", title: "Do not leak", status: "pending" }],
      mentor_memory: [{ id: "memory-1", student_id: "student-1", content: "Prefers practical examples", category: "preference" }, { id: "other-memory", student_id: "student-2", content: "Do not leak", category: "private" }],
    };
    const makeBuilder = (table = "") => {
      const builder = {
        from(nextTable: string) { return makeBuilder(nextTable); },
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle: async () => ({ data: tables[table]?.[0] ?? null, error: null }),
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: tables[table] ?? [], error: null }));
        },
      };
      return builder;
    };
    const builder = makeBuilder();

    const result = await loadMentorContext(builder as never, "user-1");
    expect(result.studentId).toBe("student-1");
    expect(result.context.profile.name).toBe("Alex");
    expect(result.context.skills[0]?.name).toBe("React");
    expect(result.context.learningTasks.map((task) => task.id)).toEqual(["task-1"]);
    expect(result.context.memory.map((item) => item.id)).toEqual(["memory-1"]);
  });
});

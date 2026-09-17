import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { skillState } from "@/lib/skillbridge-evidence";
import type { Skill } from "@/lib/skillbridge-store";
import {
  getOrCreateOwnedConversation,
  loadOwnedConversationHistory,
  persistMentorMessage,
} from "@/lib/mentor/persistence";
import {
  boundMentorJourneyData,
  buildMentorContext,
  isOpenStatus,
  mapMentorSkillProgress,
} from "@/lib/mentor/context";
import { loadMentorContext as loadAuthenticatedMentorContext } from "@/lib/mentor/context";

export { boundMentorJourneyData, buildMentorContext } from "@/lib/mentor/context";

type ServerSupabaseClient = Awaited<
  ReturnType<(typeof import("@/lib/supabase/server"))["createServerSupabaseClient"]>
>;

const MessageInput = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const MentorInput = z.object({
  userMessage: z.string().trim().min(1).max(4000),
  requestId: z.string().uuid().optional(),
});

export type MentorMessage = z.infer<typeof MessageInput>;

export type MentorContext = {
  profile: {
    name: string;
    education: string | null;
    currentRole: string | null;
  };
  careerGoal: string | null;
  skills: Array<{
    name: string;
    category: string | null;
    proficiency: number | null;
    targetProficiency: number | null;
    evidenceCount: number;
    lastPracticedAt: string | null;
    state: ReturnType<typeof skillState>;
  }>;
  readiness: {
    low: number;
    high: number;
    roleMatch: number;
    gaps: string[];
  };
  verificationSummaries: Array<{
    skillName: string;
    outcome: string;
    method: string;
    summary: string;
    reason: string;
  }>;
  roadmap: {
    id: string;
    title: string | null;
    status: string | null;
    targetRole: string | null;
  } | null;
  roadmapSteps: Array<{
    id: string;
    title: string;
    status: string | null;
    description: string | null;
  }>;
  learningTasks: Array<{
    id: string;
    title: string;
    status: string | null;
    description: string | null;
    completedAt: string | null;
  }>;
  completedLearningTasks: Array<{
    id: string;
    title: string;
    status: string | null;
    description: string | null;
    completedAt: string | null;
  }>;
  memory: Array<{
    id: string;
    content: string;
    category: string | null;
  }>;
};

export type MentorResponse = {
  message: string;
  suggestedActions: string[];
  referencedSkills: string[];
  referencedEvidence: string[];
};

export type PersistedMentorMessage = MentorMessage & {
  createdAt: string;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    suggestedActions: { type: "ARRAY", items: { type: "STRING" } },
    referencedSkills: { type: "ARRAY", items: { type: "STRING" } },
    referencedEvidence: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["message", "suggestedActions", "referencedSkills", "referencedEvidence"],
};

const SYSTEM_PROMPT = `You are SkillBridge AI, an evidence-aware career mentor.
Use only the student's supplied profile, goal, skill progress, readiness, verification summaries, and conversation.
The supplied mentor context is authoritative for profile, career goal, skills, verification status, readiness, roadmap, learning tasks, and memory.
Use the supplied context directly whenever it contains the information needed to answer the user's request.
Do not call read-only tools merely to retrieve information that is already present in the supplied context.
Use read-only tools only when the required information is missing or a fresh lookup is genuinely necessary.
Continue using create_learning_task and complete_learning_task when the user explicitly requests those actions.
The context.skills array is the authoritative list of the student's recorded skill_progress rows.
A skill appearing in context.skills is a recorded skill even when its state is needs-evidence.
needs-evidence means the student has recorded progress for that skill but does not yet have sufficient verified evidence.
Do not describe a student as having no recorded skills when context.skills contains one or more skills.
Distinguish recorded skill progress from verified evidence.
Only verification records with an appropriate verified outcome establish verified evidence.
An empty context.verificationSummaries array does not mean the student has no skills.
When answering questions about current skills, strengths, weaknesses, or skill gaps, use context.skills as the source of truth.
When answering whether a skill is verified, use the verification information rather than assuming that recorded progress is verified.
Distinguish progress or claims from verified evidence. Never call a skill verified unless a verification summary says outcome verified.
The context.learningTasks array is the authoritative list of the student's current learning tasks.
A task with status pending, current, active, in_progress, not_started, or todo is an active task.
A learning task may exist without a roadmap or roadmap step.
Never say the student has no active learning tasks when context.learningTasks contains one or more active tasks.
The context.completedLearningTasks array contains completed learning activity and is not verified evidence.
For questions about completed learning tasks or activity, use completedLearningTasks. Do not treat completed tasks as active tasks or completed activity as verified evidence.
When the student asks to complete a task, use context.learningTasks or get_my_learning_tasks to identify the task.
Only call complete_learning_task when the existing server-side explicit-intent gate permits the mutation.
Do not invent history, achievements, projects, certifications, or evidence. Say when information is unavailable.
Identify concrete skill gaps and suggest practical next actions or learning tasks. Keep responses concise and supportive.
Only call complete_learning_task when the student's request is an explicit instruction to mark a specific task complete. For ambiguous statements about working on or possibly finishing a task, ask for confirmation instead of calling it.
Only call create_learning_task when the student's latest message explicitly asks to create or add a learning task. For ambiguous questions or suggestions, propose a task without creating it and ask for clear confirmation.
Return JSON matching the requested schema.`;

function clampList(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .slice(0, limit);
}

type MentorRow = Record<string, unknown>;

const EmptyToolArguments = z.object({}).strict();
const CompleteLearningTaskArguments = z.object({
  task_id: z.string().uuid(),
}).strict();
const CreateLearningTaskArguments = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  difficulty: z.string().trim().max(40).optional(),
  estimated_minutes: z.number().int().min(1).max(480).optional(),
  due_date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date").optional(),
  roadmap_step_id: z.string().uuid().optional(),
}).strict();

export const MENTOR_TOOL_NAMES = [
  "get_my_skills",
  "get_my_career_goal",
  "get_my_verification_status",
  "get_my_roadmap",
  "get_my_learning_tasks",
  "create_learning_task",
  "complete_learning_task",
] as const;

const MENTOR_TOOL_DESCRIPTIONS: Record<MentorToolName, string> = {
  get_my_skills: "Read the authenticated student's recorded skills, progress, and evidence state.",
  get_my_career_goal: "Read the authenticated student's active career goal.",
  get_my_verification_status: "Read bounded verification summaries for the authenticated student.",
  get_my_roadmap: "Read the authenticated student's active roadmap and bounded current steps.",
  get_my_learning_tasks: "Read the authenticated student's bounded learning tasks. Active tasks are returned in learningTasks; completed tasks are returned in completedLearningTasks. Completed activity is not verification evidence.",
  create_learning_task: "Create one pending learning task for the authenticated student only when the student explicitly asks for it.",
  complete_learning_task: "Complete one existing learning task only when the student explicitly asks to mark it complete. Accepts only task_id; cannot change ownership or any other field.",
};

const MENTOR_TOOL_PARAMETERS: Record<MentorToolName, Record<string, unknown>> = {
  get_my_skills: { type: "OBJECT", properties: {}, required: [] },
  get_my_career_goal: { type: "OBJECT", properties: {}, required: [] },
  get_my_verification_status: { type: "OBJECT", properties: {}, required: [] },
  get_my_roadmap: { type: "OBJECT", properties: {}, required: [] },
  get_my_learning_tasks: { type: "OBJECT", properties: {}, required: [] },
  create_learning_task: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      description: { type: "STRING" },
      category: { type: "STRING" },
      difficulty: { type: "STRING" },
      estimated_minutes: { type: "INTEGER" },
      due_date: { type: "STRING" },
      roadmap_step_id: { type: "STRING" },
    },
    required: ["title"],
  },
  complete_learning_task: {
    type: "OBJECT",
    properties: { task_id: { type: "STRING" } },
    required: ["task_id"],
  },
};

export const GEMINI_MENTOR_TOOLS = MENTOR_TOOL_NAMES.map((name) => ({
  functionDeclarations: [{
    name,
    description: MENTOR_TOOL_DESCRIPTIONS[name],
    parameters: MENTOR_TOOL_PARAMETERS[name],
  }],
}));

export type MentorToolName = (typeof MENTOR_TOOL_NAMES)[number];

export type MentorToolContext = {
  studentId: string;
  supabase: ServerSupabaseClient;
};

export type MentorToolResult =
  | { tool: "get_my_skills"; skills: MentorContext["skills"] }
  | { tool: "get_my_career_goal"; careerGoal: string | null }
  | { tool: "get_my_verification_status"; verificationSummaries: MentorContext["verificationSummaries"] }
  | { tool: "get_my_roadmap"; roadmap: MentorContext["roadmap"]; roadmapSteps: MentorContext["roadmapSteps"] }
  | { tool: "get_my_learning_tasks"; learningTasks: MentorContext["learningTasks"]; completedLearningTasks: MentorContext["completedLearningTasks"] }
  | {
      tool: "create_learning_task";
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      difficulty: string | null;
      estimated_minutes: number | null;
      due_date: string | null;
      status: string;
      roadmap_step_id: string | null;
    }
  | { tool: "complete_learning_task"; taskId: string; status: "completed"; completed: true; alreadyCompleted: boolean; completedAt: string | null }
  | { tool: "complete_learning_task"; taskId: string; completed: false; reason: "not_found" }
  | {
      tool: "complete_learning_task";
      taskId: string;
      completed: false;
      reason: "ambiguous";
      candidates: Array<{ id: string; title: string; status: string | null; createdAt: string | null }>;
    };

export function normalizeMentorResponse(value: unknown): MentorResponse {
  const response = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    message:
      typeof response.message === "string" && response.message.trim()
        ? response.message.trim()
        : "I could not form a grounded response from the available information.",
    suggestedActions: clampList(response.suggestedActions, 4),
    referencedSkills: clampList(response.referencedSkills, 8),
    referencedEvidence: clampList(response.referencedEvidence, 6),
  };
}

export function boundMentorHistory(messages: PersistedMentorMessage[]): MentorMessage[] {
  return messages.slice(-8).map(({ role, content }) => ({ role, content }));
}

export { conversationOwnership } from "@/lib/mentor/persistence";

function toolNameSchema(toolName: unknown): MentorToolName {
  return z.enum(MENTOR_TOOL_NAMES).parse(toolName);
}

async function getMentorToolContext(
  supabase?: ServerSupabaseClient,
  studentId?: string,
): Promise<MentorToolContext> {
  if (supabase && studentId) return { studentId, supabase };

  const { createServerSupabaseClient, getServerAuthenticatedUser } = await import("@/lib/supabase/server");
  const authenticatedSupabase = supabase ?? createServerSupabaseClient();
  const user = await getServerAuthenticatedUser(authenticatedSupabase);
  if (!user) throw new Error("Please sign in before using Mentor tools.");

  const { data: profile, error } = await authenticatedSupabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error("Your student profile could not be found.");
  return { studentId: profile.id, supabase: authenticatedSupabase };
}

async function getMySkills({ studentId, supabase }: MentorToolContext): Promise<MentorToolResult> {
  const [{ data: progress, error: progressError }, { data: verificationRows, error: verificationError }] =
    await Promise.all([
      supabase
        .from("skill_progress")
        .select("skill_name, category, proficiency, target_proficiency, evidence_count, last_practiced_at")
        .eq("student_id", studentId)
        .limit(40),
      supabase
        .from("verification_records")
        .select("skill_name, outcome, timestamp")
        .eq("student_id", studentId)
        .order("timestamp", { ascending: false })
        .limit(20),
    ]);
  if (progressError) throw progressError;
  if (verificationError) throw verificationError;

  const skills = mapMentorSkillProgress(
    (progress ?? []) as Parameters<typeof mapMentorSkillProgress>[0],
    studentId,
    (verificationRows ?? []) as Parameters<typeof mapMentorSkillProgress>[2],
  );

  return { tool: "get_my_skills", skills: buildMentorContext({
    profile: { name: "", education: null, currentRole: null },
    careerGoal: null,
    skills,
    verificationSummaries: [],
  }).skills };
}

async function getMyCareerGoal({ studentId, supabase }: MentorToolContext): Promise<MentorToolResult> {
  const { data, error } = await supabase
    .from("career_goals")
    .select("target_role")
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return { tool: "get_my_career_goal", careerGoal: data?.target_role ?? null };
}

async function getMyVerificationStatus({ studentId, supabase }: MentorToolContext): Promise<MentorToolResult> {
  const { data, error } = await supabase
    .from("verification_records")
    .select("skill_name, outcome, method, evidence_summary, reason")
    .eq("student_id", studentId)
    .order("timestamp", { ascending: false })
    .limit(20);
  if (error) throw error;
  return {
    tool: "get_my_verification_status",
    verificationSummaries: (data ?? []).map((record) => ({
      skillName: record.skill_name,
      outcome: record.outcome,
      method: record.method,
      summary: record.evidence_summary,
      reason: record.reason,
    })),
  };
}

async function getMyRoadmap({ studentId, supabase }: MentorToolContext): Promise<MentorToolResult> {
  const { data, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("student_id", studentId);
  if (error) throw error;

  const activeRoadmap = boundMentorJourneyData({
    studentId,
    roadmaps: (data ?? []) as MentorRow[],
    roadmapSteps: [],
    learningTasks: [],
    memory: [],
  }).roadmap;
  if (!activeRoadmap) return { tool: "get_my_roadmap", roadmap: null, roadmapSteps: [] };

  const { data: stepData, error: stepError } = await supabase
    .from("roadmap_steps")
    .select("*")
    .eq("roadmap_id", activeRoadmap.id);
  if (stepError) throw stepError;

  const journey = boundMentorJourneyData({
    studentId,
    roadmaps: (data ?? []) as MentorRow[],
    roadmapSteps: (stepData ?? []) as MentorRow[],
    learningTasks: [],
    memory: [],
  });
  return { tool: "get_my_roadmap", roadmap: journey.roadmap, roadmapSteps: journey.roadmapSteps };
}

async function getMyLearningTasks({ studentId, supabase }: MentorToolContext): Promise<MentorToolResult> {
  const { data, error } = await supabase
    .from("learning_tasks")
    .select("*")
    .eq("student_id", studentId);
  if (error) throw error;

  const journey = boundMentorJourneyData({
    studentId,
    roadmaps: [],
    roadmapSteps: [],
    learningTasks: (data ?? []) as MentorRow[],
    memory: [],
  });
  return {
    tool: "get_my_learning_tasks",
    learningTasks: journey.learningTasks,
    completedLearningTasks: journey.completedLearningTasks,
  };
}

async function createMentorLearningTask(
  { studentId, supabase }: MentorToolContext,
  args: unknown,
): Promise<MentorToolResult> {
  const input = CreateLearningTaskArguments.parse(args);
  if (input.roadmap_step_id) {
    const { data: roadmapStep, error: roadmapStepError } = await supabase
      .from("roadmap_steps")
      .select("id, roadmap_id")
      .eq("id", input.roadmap_step_id)
      .maybeSingle();
    if (roadmapStepError) throw roadmapStepError;
    if (!roadmapStep) throw new Error("The selected roadmap step could not be found.");

    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .select("id")
      .eq("id", roadmapStep.roadmap_id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (roadmapError) throw roadmapError;
    if (!roadmap) throw new Error("The selected roadmap step is not owned by you.");
  }

  const taskFields = {
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
    ...(input.estimated_minutes !== undefined ? { estimated_minutes: input.estimated_minutes } : {}),
    ...(input.due_date !== undefined ? { due_date: input.due_date } : {}),
    ...(input.roadmap_step_id !== undefined ? { roadmap_step_id: input.roadmap_step_id } : {}),
    student_id: studentId,
    status: "pending",
  };
  const { data: task, error } = await supabase
    .from("learning_tasks")
    .insert(taskFields)
    .select("id, title, description, category, difficulty, estimated_minutes, due_date, status, roadmap_step_id")
    .single();
  if (error) throw error;
  if (!task) throw new Error("The learning task could not be created.");

  return {
    tool: "create_learning_task",
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    category: task.category ?? null,
    difficulty: task.difficulty ?? null,
    estimated_minutes: task.estimated_minutes ?? null,
    due_date: task.due_date ?? null,
    status: task.status,
    roadmap_step_id: task.roadmap_step_id ?? null,
  };
}

async function completeLearningTask(
  { studentId, supabase }: MentorToolContext,
  args: unknown,
): Promise<MentorToolResult> {
  const { task_id: taskId } = CompleteLearningTaskArguments.parse(args);
  const { data: task, error: lookupError } = await supabase
    .from("learning_tasks")
    .select("id, title, status, completed_at, created_at")
    .eq("id", taskId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!task) return { tool: "complete_learning_task", taskId, completed: false, reason: "not_found" };
  if (task.status === "completed") {
    return {
      tool: "complete_learning_task",
      taskId,
      status: "completed",
      completed: true,
      alreadyCompleted: true,
      completedAt: task.completed_at ?? null,
    };
  }

  const { data: matchingTasks, error: matchingTasksError } = await supabase
    .from("learning_tasks")
    .select("id, title, status, created_at")
    .eq("student_id", studentId)
    .eq("title", task.title);
  if (matchingTasksError) throw matchingTasksError;
  const activeMatches = (matchingTasks ?? [])
    .filter((matchingTask) => isOpenStatus(matchingTask as MentorRow))
    .map((matchingTask) => ({
      id: matchingTask.id,
      title: matchingTask.title,
      status: matchingTask.status ?? null,
      createdAt: matchingTask.created_at ?? null,
    }));
  if (activeMatches.length > 1) {
    return { tool: "complete_learning_task", taskId, completed: false, reason: "ambiguous", candidates: activeMatches };
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from("learning_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("student_id", studentId)
    .select("id, status, completed_at")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updatedTask) return { tool: "complete_learning_task", taskId, completed: false, reason: "not_found" };
  return {
    tool: "complete_learning_task",
    taskId,
    status: "completed",
    completed: true,
    alreadyCompleted: false,
    completedAt: updatedTask.completed_at ?? null,
  };
}

type MentorToolHandler = (context: MentorToolContext, args?: unknown) => Promise<MentorToolResult>;

const MENTOR_TOOL_REGISTRY: Record<MentorToolName, MentorToolHandler> = {
  get_my_skills: (context) => getMySkills(context),
  get_my_career_goal: (context) => getMyCareerGoal(context),
  get_my_verification_status: (context) => getMyVerificationStatus(context),
  get_my_roadmap: (context) => getMyRoadmap(context),
  get_my_learning_tasks: (context) => getMyLearningTasks(context),
  create_learning_task: (context, args) => createMentorLearningTask(context, args),
  complete_learning_task: (context, args) => completeLearningTask(context, args),
};

export function resolveMentorTool(toolName: unknown) {
  const name = toolNameSchema(toolName);
  return MENTOR_TOOL_REGISTRY[name];
}

export async function executeMentorTool(
  toolName: unknown,
  args: unknown = {},
  supabase?: ServerSupabaseClient,
  studentId?: string,
): Promise<MentorToolResult> {
  const name = toolNameSchema(toolName);
  if (name === "complete_learning_task") {
    CompleteLearningTaskArguments.parse(args);
    return await resolveMentorTool(name)(await getMentorToolContext(supabase, studentId), args);
  }
  if (name === "create_learning_task") {
    CreateLearningTaskArguments.parse(args);
    return await resolveMentorTool(name)(await getMentorToolContext(supabase, studentId), args);
  }
  EmptyToolArguments.parse(args);
  return await resolveMentorTool(name)(await getMentorToolContext(supabase, studentId));
}

type GeminiPart = {
  text?: string;
  functionCall?: { name?: unknown; args?: unknown };
  functionResponse?: { name?: string; response?: unknown };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { role?: string; parts?: GeminiPart[] } }>;
};

type MentorToolExecutor = (toolName: unknown, args?: unknown) => Promise<MentorToolResult>;

const MAX_TOOL_ROUNDS = 2;
const GEMINI_RETRY_DELAYS_MS = [500, 1000] as const;
const GEMINI_RETRY_JITTER_MS = 250;

function waitForGeminiRetry(delayMs: number): Promise<void> {
  const jitter = Math.floor(Math.random() * (GEMINI_RETRY_JITTER_MS + 1));
  return new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
}

function hasExplicitCompletionIntent(messages: MentorMessage[]): boolean {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content;
  if (!latestUserMessage) return false;

  const normalized = latestUserMessage.trim().toLowerCase();
  if (/(ignore|bypass|override).*(instruction|prompt|rule)|system prompt|developer message|jailbreak/.test(normalized)) {
    return false;
  }

  const explicitInstruction =
    /\b(mark|set|complete)\b.*\b(task|it|this|today'?s task)\b.*\b(complete|completed|done)\b/.test(normalized) ||
    /\b(mark|set)\b.*\b(task|it|this|today'?s task)\b/.test(normalized) && /\b(done|complete|completed)\b/.test(normalized) ||
    /^complete\s+(the\s+)?(task|it|this)\b/.test(normalized);
  if (explicitInstruction) return true;

  const confirmation = /^(yes|yep|yeah)(,?\s+please(\s+do)?)?[.! ]*$|^(confirm|confirmed|please do|do it|go ahead|yes,? mark it complete)[.! ]*$/.test(normalized);
  if (!confirmation) return false;

  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant")?.content.toLowerCase() ?? "";
  return /\b(confirm|mark|complete|completed|done)\b/.test(latestAssistantMessage);
}

function hasExplicitCreationIntent(messages: MentorMessage[]): boolean {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content;
  if (!latestUserMessage) return false;

  const normalized = latestUserMessage.trim().toLowerCase();
  if (/(ignore|bypass|override).*(instruction|prompt|rule)|system prompt|developer message|jailbreak/.test(normalized)) {
    return false;
  }

  const explicitInstruction = /\b(create|add)\b(?:\s+[\w-]+){0,8}\s+\b(task|learning task)\b/.test(normalized);
  if (explicitInstruction) return true;

  const confirmation = /^(yes|yep|yeah|confirm|confirmed|please do|do it|go ahead)(,?\s+please)?[.! ]*$/.test(normalized);
  if (!confirmation) return false;

  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant")?.content.toLowerCase() ?? "";
  return /\b(create|add|set up|suggest|propose)\b.*\b(task|learning task)\b|\b(task|learning task)\b.*\b(create|add|set up|suggest|propose)\b/.test(latestAssistantMessage);
}

function parseMentorToolArguments(toolName: MentorToolName, args: unknown): unknown {
  if (toolName === "complete_learning_task") return CompleteLearningTaskArguments.parse(args ?? {});
  if (toolName === "create_learning_task") return CreateLearningTaskArguments.parse(args ?? {});
  return EmptyToolArguments.parse(args ?? {});
}

function completionFailureResponse(result: Extract<MentorToolResult, { tool: "complete_learning_task"; completed: false }>): MentorResponse {
  if (result.reason === "ambiguous") {
    return normalizeMentorResponse({
      message: "I found multiple active tasks with that title, so I did not complete one. Please specify which task you mean.",
      suggestedActions: ["Specify the exact task you want to complete."],
      referencedSkills: [],
      referencedEvidence: [],
    });
  }

  return normalizeMentorResponse({
    message: "I could not find that active learning task, so nothing was completed. Please choose a task from your current learning tasks.",
    suggestedActions: ["Choose the exact task you want to complete."],
    referencedSkills: [],
    referencedEvidence: [],
  });
}

export async function callGemini(
  recentMessages: MentorMessage[],
  context: MentorContext,
  executeTool: MentorToolExecutor = executeMentorTool,
): Promise<MentorResponse> {
  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured. Add GEMINI_API_KEY to your local .env file.");

  const model = process.env["GEMINI_MODEL"] ?? "gemini-1.5-flash";
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [
    {
      role: "user",
      parts: [{ text: JSON.stringify({ context, recentMessages }) }],
    },
  ];
  let toolRounds = 0;

  while (true) {
    let response: Response | undefined;
    try {
      for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt += 1) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents,
              tools: GEMINI_MENTOR_TOOLS,
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
                temperature: 0.1,
                maxOutputTokens: 700,
              },
            }),
          },
        );
        if (response.ok) break;

        const isRetryable = response.status === 503;
        if (!isRetryable || attempt === GEMINI_RETRY_DELAYS_MS.length) break;
        await waitForGeminiRetry(GEMINI_RETRY_DELAYS_MS[attempt]);
      }
    } catch (error) {
      throw error;
    }
    if (!response) throw new Error("No Gemini response.");
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }
    let payload: GeminiResponse;
    try {
      payload = (await response.json()) as GeminiResponse;
    } catch (error) {
      throw error;
    }
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const functionCall = parts.find((part) => part.functionCall)?.functionCall;

    if (!functionCall) {
      const text = parts.find((part) => typeof part.text === "string")?.text;
      if (!text) throw new Error("Mentor returned an empty response.");
      return normalizeMentorResponse(JSON.parse(text));
    }

    if (toolRounds >= MAX_TOOL_ROUNDS) {
      throw new Error("Mentor requested too many tool calls.");
    }

    let toolName: MentorToolName;
    let toolArguments: unknown;
    try {
      toolName = toolNameSchema(functionCall.name);
      toolArguments = parseMentorToolArguments(toolName, functionCall.args);
    } catch (error) {
      throw error;
    }
    if (toolName === "complete_learning_task" && !hasExplicitCompletionIntent(recentMessages)) {
      return normalizeMentorResponse({
        message: "I think you may have finished a task. Do you want me to mark it complete?",
        suggestedActions: [],
        referencedSkills: [],
        referencedEvidence: [],
      });
    }
    if (toolName === "create_learning_task" && !hasExplicitCreationIntent(recentMessages)) {
      return normalizeMentorResponse({
        message: "I can suggest a learning task, but I need a clear request to create it before I add anything.",
        suggestedActions: [],
        referencedSkills: [],
        referencedEvidence: [],
      });
    }
    const toolResult = await executeTool(toolName, toolArguments);
    if (toolName === "complete_learning_task" && toolResult.tool === "complete_learning_task" && !toolResult.completed) {
      return completionFailureResponse(toolResult);
    }
    const modelParts = parts.filter((part) => part.functionCall || part.text);
    contents.push({ role: "model", parts: modelParts });
    contents.push({
      role: "user",
      parts: [{ functionResponse: { name: toolName, response: toolResult } }],
    });
    toolRounds += 1;
  }
}

export const askMentor = createServerFn({ method: "POST" })
  .validator((input: unknown) => MentorInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const { createServerSupabaseClient, getServerAuthenticatedUser } = await import("@/lib/supabase/server");
      const supabase = createServerSupabaseClient();
      const user = await getServerAuthenticatedUser(supabase);
      if (!user) throw new Error("Please sign in before using the AI mentor.");
      let studentId: string;
      let context: MentorContext;
      ({ studentId, context } = await loadAuthenticatedMentorContext(supabase, user.id));
      let conversationId: string;
      conversationId = await getOrCreateOwnedConversation(supabase, studentId);
      await persistMentorMessage(
        supabase,
        studentId,
        conversationId,
        { role: "user", content: data.userMessage },
        data.requestId,
      );
      const history = await loadOwnedConversationHistory(supabase, studentId, conversationId);
      let response: MentorResponse;
      try {
        response = await callGemini(
          history,
          context,
          (toolName, args) => executeMentorTool(toolName, args, supabase, studentId),
        );
      } catch (error) {
        throw new Error("The mentor could not respond right now. Your message was saved; please try again.");
      }
      await persistMentorMessage(
        supabase,
        studentId,
        conversationId,
        { role: "assistant", content: response.message },
        data.requestId,
      );
      return response;
    } catch (error) {
      throw error;
    }
  });

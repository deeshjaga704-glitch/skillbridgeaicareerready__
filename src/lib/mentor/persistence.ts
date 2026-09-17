import type { MentorMessage, PersistedMentorMessage } from "@/lib/mentor.functions";

type ServerSupabaseClient = Awaited<
  ReturnType<(typeof import("@/lib/supabase/server"))["createServerSupabaseClient"]>
>;

const conversationLocks = new Map<string, Promise<void>>();
const inFlightTurns = new Map<string, Promise<void>>();
const completedTurns = new Set<string>();
const MAX_COMPLETED_TURNS = 2048;

export function conversationOwnership(studentId: string) {
  return { student_id: studentId };
}

async function withStudentConversationLock<T>(studentId: string, operation: () => Promise<T>): Promise<T> {
  const previous = conversationLocks.get(studentId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  conversationLocks.set(studentId, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (conversationLocks.get(studentId) === queued) conversationLocks.delete(studentId);
  }
}

export async function getOrCreateOwnedConversation(
  supabase: ServerSupabaseClient,
  studentId: string,
): Promise<string> {
  return withStudentConversationLock(studentId, async () => {
    const ownership = conversationOwnership(studentId);
    const { data: existing, error: lookupError } = await supabase
      .from("mentor_conversations")
      .select("id")
      .match(ownership)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.id) return existing.id;

    const { data: created, error: createError } = await supabase
      .from("mentor_conversations")
      .insert({ ...ownership, status: "active" })
      .select("id")
      .single();
    if (!createError && created?.id) return created.id;

    // Without a database uniqueness constraint, a concurrent process can still win the race.
    // Re-read before surfacing the insert error so an existing conversation remains usable.
    const { data: concurrent, error: retryLookupError } = await supabase
      .from("mentor_conversations")
      .select("id")
      .match(ownership)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (retryLookupError) throw retryLookupError;
    if (concurrent?.id) return concurrent.id;
    if (createError) throw createError;
    throw new Error("The mentor conversation could not be created.");
  });
}

export async function loadOwnedConversationHistory(
  supabase: ServerSupabaseClient,
  studentId: string,
  conversationId: string,
): Promise<MentorMessage[]> {
  const { data: conversation, error: conversationError } = await supabase
    .from("mentor_conversations")
    .select("id")
    .eq("id", conversationId)
    .match(conversationOwnership(studentId))
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error("The mentor conversation does not belong to you.");

  const { data, error } = await supabase
    .from("mentor_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  return (data ?? [])
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 8)
    .reverse()
    .map((message) => ({
    role: message.role as MentorMessage["role"],
    content: message.content,
    createdAt: message.created_at,
  } satisfies PersistedMentorMessage)).map(({ role, content }) => ({ role, content }));
}

async function insertMessage(
  supabase: ServerSupabaseClient,
  conversationId: string,
  message: MentorMessage,
): Promise<void> {
  const { error } = await supabase.from("mentor_messages").insert({
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
  });
  if (error) throw error;
}

export async function persistMentorMessage(
  supabase: ServerSupabaseClient,
  studentId: string,
  conversationId: string,
  message: MentorMessage,
  requestId?: string,
): Promise<void> {
  const { data: conversation, error: ownershipError } = await supabase
    .from("mentor_conversations")
    .select("id")
    .eq("id", conversationId)
    .match(conversationOwnership(studentId))
    .maybeSingle();
  if (ownershipError) throw ownershipError;
  if (!conversation) throw new Error("The mentor conversation does not belong to you.");

  if (!requestId) {
    await insertMessage(supabase, conversationId, message);
    return;
  }

  const key = `${studentId}:${conversationId}:${requestId}:${message.role}`;
  if (completedTurns.has(key)) return;
  const existing = inFlightTurns.get(key);
  if (existing) return existing;

  const operation = insertMessage(supabase, conversationId, message).then(() => {
    completedTurns.add(key);
    if (completedTurns.size > MAX_COMPLETED_TURNS) {
      const oldest = completedTurns.values().next().value;
      if (oldest) completedTurns.delete(oldest);
    }
  }).finally(() => {
    if (inFlightTurns.get(key) === operation) inFlightTurns.delete(key);
  });
  inFlightTurns.set(key, operation);
  await operation;
}

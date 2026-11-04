import "server-only";
import type { ChartSpec, CopilotEvent } from "@/lib/ai/contracts";
import type { CopilotMessage } from "@/lib/ai/copilot";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Saved Copilot conversations (ai_conversations / ai_messages, see *_ai_conversations.sql).
 * Writes happen here, on the server, with the service role, after ownership is checked.
 * Users can only read, rename and delete their own conversations (RLS). The model's context
 * is rebuilt from these rows, never from history sent by the browser.
 */

export const RETENTION_DAYS = 90;
const CONTEXT_MESSAGES = 10;
const MAX_TITLE = 80;

export interface ConversationRef {
  id: string;
  title: string;
}

/** Short title from the first question (sentence-cased, trimmed to a word boundary). */
export function titleFrom(question: string): string {
  const q = question.replace(/\s+/g, " ").trim();
  if (q.length <= MAX_TITLE) return q;
  const cut = q.slice(0, MAX_TITLE);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : MAX_TITLE).trim()}…`;
}

/**
 * Returns the caller's conversation, or creates one titled from the first question.
 * A conversation id that isn't theirs (or has expired) is treated as not found.
 */
export async function ensureConversation(userId: string, conversationId: string | null, question: string): Promise<ConversationRef | null> {
  const admin = createAdminClient();
  if (conversationId) {
    const since = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();
    const { data } = await admin
      .from("ai_conversations")
      .select("id, title, user_id, updated_at")
      .eq("id", conversationId)
      .gte("updated_at", since)
      .maybeSingle();
    if (!data || data.user_id !== userId) return null;
    return { id: data.id, title: data.title };
  }
  const { data, error } = await admin.from("ai_conversations").insert({ user_id: userId, title: titleFrom(question) }).select("id, title").single();
  if (error) throw new Error(`Could not start a conversation: ${error.message}`);
  return data;
}

/** The last messages of a conversation, oldest first, as model context. */
export async function loadContext(conversationId: string): Promise<CopilotMessage[]> {
  const { data } = await createAdminClient()
    .from("ai_messages")
    .select("role, content, status, policy")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(CONTEXT_MESSAGES);
  return (data ?? [])
    .reverse()
    .filter((m) => m.content.trim() && m.status === "done")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

// ---------------------------------------------------------------- recorder --

interface RecordedStep {
  kind: "tool" | "note";
  id: string;
  name?: string;
  input?: unknown;
  status?: "ok" | "error";
  rows?: number;
  ms?: number;
  summary?: string;
  text?: string;
}

/**
 * Captures what the user saw for one assistant turn from the event stream (same rules as
 * the client reducer: text written before a tool call is a reasoning note, not the answer).
 */
export class TurnRecorder {
  runId: string | null = null;
  content = "";
  steps: RecordedStep[] = [];
  charts: ChartSpec[] = [];
  records: unknown[] = [];
  policy: { outcome: string; category: string; label: string } | null = null;
  status: "done" | "error" | "stopped" = "done";
  error: string | null = null;
  latencyMs: number | null = null;
  private finished = false;

  push(event: CopilotEvent) {
    switch (event.type) {
      case "run":
        this.runId = event.runId;
        break;
      case "tool_call": {
        const note = this.content.trim();
        if (note) this.steps.push({ kind: "note", id: `note-${this.steps.length}`, text: note });
        this.steps.push({ kind: "tool", id: event.id, name: event.name, input: event.input });
        this.content = "";
        break;
      }
      case "tool_result":
        this.steps = this.steps.map((s) =>
          s.kind === "tool" && s.id === event.id ? { ...s, status: event.ok ? "ok" : "error", rows: event.rows, ms: event.ms, summary: event.summary } : s,
        );
        break;
      case "text":
        this.content += event.delta;
        break;
      case "chart":
        this.charts.push(event.chart);
        break;
      case "records":
        this.records = event.records;
        break;
      case "policy":
        this.policy = { outcome: event.outcome, category: event.category, label: event.label };
        break;
      case "done":
        this.finished = true;
        this.latencyMs = event.latencyMs;
        break;
      case "error":
        this.finished = true;
        this.status = "error";
        this.error = event.message;
        break;
    }
  }

  /** Called when the stream ends: a run cut off by the client counts as stopped. */
  close() {
    if (!this.finished) this.status = "stopped";
  }
}

/** Persists one question and its answer, and bumps the conversation. */
export async function saveTurn(conversation: ConversationRef, userId: string, question: string, turn: TurnRecorder) {
  const admin = createAdminClient();
  // Every column explicit: in a bulk insert PostgREST fills keys missing from a row with NULL
  // (not the column default), which the NOT NULL constraints reject.
  const { error } = await admin.from("ai_messages").insert(
    [
    {
      conversation_id: conversation.id,
      user_id: userId,
      role: "user",
      content: question,
      status: "done",
      steps: [],
      charts: [],
      records: [],
      policy: null,
      error: null,
      latency_ms: null,
      run_id: turn.runId,
    },
    {
      conversation_id: conversation.id,
      user_id: userId,
      role: "assistant",
      content: turn.content.slice(0, 40000),
      status: turn.status,
      steps: turn.steps,
      charts: turn.charts,
      records: turn.records,
      policy: turn.policy,
      error: turn.error,
      latency_ms: turn.latencyMs,
      run_id: turn.runId,
    },
    ],
    { defaultToNull: false },
  );
  if (error) {
    console.error("[ai] could not save conversation turn:", error.message);
    return;
  }
  const { count } = await admin.from("ai_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id);
  await admin.from("ai_conversations").update({ updated_at: new Date().toISOString(), message_count: count ?? 0 }).eq("id", conversation.id);
}

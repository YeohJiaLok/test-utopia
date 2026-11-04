"use client";

import { useSyncExternalStore } from "react";
import type { ChartSpec, CopilotEvent } from "@/lib/ai/contracts";
import { MAX_QUESTION_CHARS } from "@/lib/ai/catalogue";
import { createSseParser } from "@/lib/ai/sse";
import { getConversation, type StoredMessage } from "@/app/(app)/ai-history-actions";
import type { CopilotRecord } from "@/lib/ai/types";

export type TraceStep =
  | {
      kind: "tool";
      id: string;
      name: string;
      input: unknown;
      status: "running" | "ok" | "error";
      rows?: number;
      ms?: number;
      summary?: string;
    }
  | { kind: "note"; id: string; text: string };

export interface UserTurn {
  id: string;
  role: "user";
  content: string;
  /** When the question was asked (ISO); set for turns reopened from history. */
  asOf?: string;
}

export interface AssistantTurn {
  id: string;
  role: "assistant";
  content: string;
  steps: TraceStep[];
  status: "streaming" | "done" | "error" | "stopped";
  statusLabel: string;
  records: CopilotRecord[];
  startedAt: number;
  runId?: string;
  error?: string;
  latencyMs?: number;
  usage?: { input_tokens: number; output_tokens: number };
  /** Charts the agent drew for this answer (render_chart). */
  charts: ChartSpec[];
  /** Set when the acceptable-use policy blocked or the model declined the question. */
  policy?: { outcome: "blocked" | "refused"; category: string; label: string };
  /** Set for answers reopened from history: the figures are as of this time (ISO). */
  asOf?: string;
}

export type Turn = UserTurn | AssistantTurn;

interface CopilotState {
  turns: Turn[];
  pending: boolean;
  /** The saved conversation these turns belong to (null until the first answer starts). */
  conversationId: string | null;
  title: string | null;
  /** Loading a conversation from history. */
  loading: boolean;
}

// ---------------------------------------------------------------- store --
// Module-level store so the conversation survives the window closing and route changes.
// The server keeps the durable copy (ai_conversations); this is the on-screen view of it.

const INITIAL: CopilotState = { turns: [], pending: false, conversationId: null, title: null, loading: false };
let state: CopilotState = INITIAL;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
let seq = 0;

function setState(next: CopilotState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateAssistant(id: string, fn: (turn: AssistantTurn) => AssistantTurn) {
  setState({
    ...state,
    turns: state.turns.map((t) => (t.id === id && t.role === "assistant" ? fn(t) : t)),
  });
}

/** Apply one streamed event to the assistant turn. Exported for tests/readability. */
export function reduceEvent(turn: AssistantTurn, event: CopilotEvent): AssistantTurn {
  switch (event.type) {
    case "run":
      return { ...turn, runId: event.runId };
    case "status":
      return { ...turn, statusLabel: event.label };
    case "tool_call": {
      // Text the model wrote before deciding to call a tool is reasoning, not the
      // answer: move it into the trace as a note.
      const steps = [...turn.steps];
      const note = turn.content.trim();
      if (note) steps.push({ kind: "note", id: `note-${steps.length}`, text: note });
      steps.push({ kind: "tool", id: event.id, name: event.name, input: event.input, status: "running" });
      return { ...turn, content: "", steps };
    }
    case "tool_result":
      return {
        ...turn,
        steps: turn.steps.map((s) =>
          s.kind === "tool" && s.id === event.id
            ? { ...s, status: event.ok ? "ok" : "error", rows: event.rows, ms: event.ms, summary: event.summary }
            : s,
        ),
      };
    case "text":
      return { ...turn, content: turn.content + event.delta };
    case "records":
      return { ...turn, records: event.records };
    case "conversation":
      return turn; // conversation-level, handled by the store
    case "chart":
      return { ...turn, charts: [...turn.charts, event.chart] };
    case "policy":
      return { ...turn, policy: { outcome: event.outcome, category: event.category, label: event.label } };
    case "done":
      return { ...turn, status: "done", statusLabel: "Done", latencyMs: event.latencyMs, usage: event.usage };
    case "error":
      return {
        ...turn,
        status: "error",
        error: event.message,
        latencyMs: Date.now() - turn.startedAt,
        steps: turn.steps.map((s) => (s.kind === "tool" && s.status === "running" ? { ...s, status: "error" } : s)),
      };
  }
}

async function readError(res: Response) {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // not JSON
  }
  if (res.status === 401) return "Your session has expired. Sign in again.";
  if (res.status === 403) return "You do not have access to the Ops Copilot.";
  return `The assistant is unavailable (HTTP ${res.status}).`;
}

async function ask(question: string) {
  const text = question.trim();
  if (!text || state.pending || state.loading) return;
  if (text.length > MAX_QUESTION_CHARS) return;

  const userTurn: UserTurn = { id: `u${++seq}`, role: "user", content: text };
  const assistantId = `a${++seq}`;
  const assistant: AssistantTurn = {
    id: assistantId,
    role: "assistant",
    content: "",
    steps: [],
    status: "streaming",
    statusLabel: "Connecting",
    records: [],
    charts: [],
    startedAt: Date.now(),
  };
  // Only the question and the conversation id: the server rebuilds the context from its copy.
  const body = { question: text, conversationId: state.conversationId };
  setState({ ...state, turns: [...state.turns, userTurn, assistant], pending: true });

  const ctrl = new AbortController();
  controller = ctrl;
  let terminal = false;

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const message = await readError(res);
      terminal = true;
      // The conversation was deleted or expired elsewhere: the next question starts a new one.
      if (res.status === 404) setState({ ...state, conversationId: null, title: null });
      updateAssistant(assistantId, (t) => reduceEvent(t, { type: "error", message }));
      return;
    }

    const parser = createSseParser((event) => {
      if (event.type === "conversation") {
        setState({ ...state, conversationId: event.id, title: event.title });
        return;
      }
      if (event.type === "done" || event.type === "error") terminal = true;
      updateAssistant(assistantId, (t) => reduceEvent(t, event));
    });
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(value);
      // The answer is complete: free the input now instead of waiting for the server to
      // finish writing the governance log and close the stream.
      if (terminal) {
        void reader.cancel().catch(() => {});
        break;
      }
    }
    parser.flush();
    if (!terminal) {
      updateAssistant(assistantId, (t) =>
        reduceEvent(t, { type: "error", message: "The connection closed before the answer finished. Please try again." }),
      );
    }
  } catch (err) {
    if (ctrl.signal.aborted) {
      updateAssistant(assistantId, (t) => ({
        ...t,
        status: "stopped",
        statusLabel: "Stopped",
        latencyMs: Date.now() - t.startedAt,
        steps: t.steps.map((s) => (s.kind === "tool" && s.status === "running" ? { ...s, status: "error" } : s)),
      }));
    } else {
      console.error("[copilot] request failed", err);
      updateAssistant(assistantId, (t) => reduceEvent(t, { type: "error", message: "Network error — check your connection and try again." }));
    }
  } finally {
    if (controller === ctrl) controller = null;
    setState({ ...state, pending: false });
  }
}

function stop() {
  controller?.abort();
}

function reset() {
  controller?.abort();
  setState(INITIAL);
}

function toTurn(m: StoredMessage): Turn {
  if (m.role === "user") return { id: `h${m.id}`, role: "user", content: m.content, asOf: m.createdAt };
  return {
    id: `h${m.id}`,
    role: "assistant",
    content: m.content,
    steps: m.steps as TraceStep[],
    status: m.status,
    statusLabel: m.status === "done" ? "Done" : m.status === "stopped" ? "Stopped" : "Error",
    records: m.records,
    charts: m.charts,
    policy: m.policy ?? undefined,
    error: m.error ?? undefined,
    latencyMs: m.latencyMs ?? undefined,
    runId: m.runId ?? undefined,
    startedAt: new Date(m.createdAt).getTime(),
    asOf: m.createdAt,
  };
}

/** Reopens a saved conversation (from the server, never from browser storage). */
async function openConversation(id: string): Promise<boolean> {
  if (state.pending) return false;
  const userAtStart = owner;
  setState({ ...state, loading: true });
  try {
    const found = await getConversation(id);
    if (owner !== userAtStart) return false; // signed out meanwhile
    if (!found) {
      setState({ ...state, loading: false });
      return false;
    }
    setState({
      turns: found.messages.map(toTurn),
      pending: false,
      conversationId: found.conversation.id,
      title: found.conversation.title,
      loading: false,
    });
    return true;
  } catch {
    setState({ ...state, loading: false });
    return false;
  }
}

/** Keeps the header in sync after a rename from the history list. */
function renamed(id: string, title: string) {
  if (state.conversationId === id) setState({ ...state, title });
}

/** The open conversation was deleted from history: start fresh. */
function forget(id: string) {
  if (state.conversationId === id) reset();
}

// The store is module-level, and signing out / in again is a client-side navigation, so the
// conversation must be tied to the user who had it. Never show one user's chat to another.
let owner: string | null = null;

/** Binds the conversation to the signed-in user; a different user starts from an empty chat. */
export function bindCopilotOwner(userId: string) {
  if (owner === userId) return;
  owner = userId;
  reset();
}

/** Wipes the conversation (sign-out). */
export function clearCopilot() {
  owner = null;
  reset();
}

export function useCopilot() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  return { ...snapshot, ask, stop, reset, openConversation, renamed, forget };
}

"use client";

import { useSyncExternalStore } from "react";
import type { ChartSpec, CopilotEvent } from "@/lib/ai/contracts";
import { MAX_QUESTION_CHARS } from "@/lib/ai/catalogue";
import { createSseParser } from "@/lib/ai/sse";
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
}

export type Turn = UserTurn | AssistantTurn;

interface CopilotState {
  turns: Turn[];
  pending: boolean;
}

// ---------------------------------------------------------------- store --
// Module-level store so the conversation survives the drawer closing and route
// changes (the drawer and the full-page view share one conversation).

const INITIAL: CopilotState = { turns: [], pending: false };
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

function historyFor(turns: Turn[]) {
  return turns
    .filter((t) => t.role === "user" || (t.status === "done" && t.content.trim()))
    .map((t) => ({ role: t.role, content: t.content }));
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
  if (!text || state.pending) return;
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
  const messages = [...historyFor(state.turns), { role: "user" as const, content: text }];
  setState({ turns: [...state.turns, userTurn, assistant], pending: true });

  const ctrl = new AbortController();
  controller = ctrl;
  let terminal = false;

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ messages }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      const message = await readError(res);
      terminal = true;
      updateAssistant(assistantId, (t) => reduceEvent(t, { type: "error", message }));
      return;
    }

    const parser = createSseParser((event) => {
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
  return { ...snapshot, ask, stop, reset };
}

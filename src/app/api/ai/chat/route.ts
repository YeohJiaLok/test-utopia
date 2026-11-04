import { z } from "zod";
import type { CopilotEvent } from "@/lib/ai/contracts";
import { MAX_QUESTION_CHARS } from "@/lib/ai/catalogue";
import { runCopilot } from "@/lib/ai/copilot";
import { ensureConversation, loadContext, saveTurn, TurnRecorder } from "@/lib/ai/conversations";
import { authorizeApi, jsonError } from "@/lib/ai/http";
import { logAiRun } from "@/lib/ai/log";
import { POLICY_LABEL, RATE_LIMIT, screenQuestion } from "@/lib/ai/policy";
import { encodeSse, SSE_HEARTBEAT } from "@/lib/ai/sse";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_CONTEXT_CHARS = 6000;

/**
 * The browser sends only the new question and which conversation it belongs to. The model's
 * context comes from the saved conversation on the server, so history can't be forged.
 */
const bodySchema = z.object({
  question: z.string().trim().min(1, "Ask a question."),
  conversationId: z.uuid().nullish(),
});

/** Copilot questions this user asked in the rate-limit window (all outcomes count). */
async function recentQuestions(userId: string): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
  const { count } = await createAdminClient()
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "copilot")
    .gte("created_at", since);
  return count ?? 0;
}

/** POST /api/ai/chat — Ops Copilot, streamed as Server-Sent Events of CopilotEvent. */
export async function POST(request: Request) {
  const auth = await authorizeApi(["manager", "admin"]);
  if ("response" in auth) return auth.response;
  const user = auth.user;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError(400, "Expected { question, conversationId? }.");
  const question = parsed.data.question;

  const conversation = await ensureConversation(user.id, parsed.data.conversationId ?? null, question);
  if (!conversation) return jsonError(404, "That conversation no longer exists. Start a new one.");

  // Acceptable-use policy and rate limit, before any model call.
  const screen = screenQuestion(question, MAX_QUESTION_CHARS);
  const blocked: { category: keyof typeof POLICY_LABEL; message: string } | null = !screen.allowed
    ? { category: screen.category, message: screen.message }
    : (await recentQuestions(user.id)) >= RATE_LIMIT.max
      ? {
          category: "rate_limit",
          message: `You've asked ${RATE_LIMIT.max} questions in the last ${RATE_LIMIT.windowMinutes} minutes. Please wait a few minutes and try again.`,
        }
      : null;

  const context = blocked
    ? []
    : [...(await loadContext(conversation.id)), { role: "user" as const, content: question }].map((m) => ({
        role: m.role,
        content: m.content.trim().slice(0, MAX_CONTEXT_CHARS),
      }));

  // Every tool query runs through this user-scoped client, so RLS applies to the agent.
  const supabase = await createClient();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const recorder = new TurnRecorder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };
      const emit = (event: CopilotEvent) => {
        recorder.push(event);
        write(encodeSse(event));
      };
      const heartbeat = setInterval(() => write(SSE_HEARTBEAT), 15_000);
      try {
        emit({ type: "conversation", id: conversation.id, title: conversation.title });
        if (blocked) {
          const runId = crypto.randomUUID();
          await logAiRun({
            id: runId,
            kind: "copilot",
            userId: user.id,
            input: question,
            output: blocked.message,
            model: null,
            latencyMs: 0,
            status: "blocked",
            error: `Policy: ${blocked.category}`,
          });
          emit({ type: "run", runId });
          emit({ type: "policy", outcome: "blocked", category: blocked.category, label: POLICY_LABEL[blocked.category] });
          emit({ type: "text", delta: blocked.message });
          emit({ type: "done", latencyMs: 0 });
        } else {
          await runCopilot({ user, supabase, messages: context, signal: abort.signal, emit });
        }
      } finally {
        clearInterval(heartbeat);
        recorder.close();
        // Saved even if the browser disconnected: the history matches the audit log.
        await saveTurn(conversation, user.id, question, recorder);
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // stream already closed by the client
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

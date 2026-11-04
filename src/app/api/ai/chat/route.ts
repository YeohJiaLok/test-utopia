import { z } from "zod";
import type { CopilotEvent } from "@/lib/ai/contracts";
import { MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "@/lib/ai/catalogue";
import { runCopilot, type CopilotMessage } from "@/lib/ai/copilot";
import { authorizeApi, jsonError } from "@/lib/ai/http";
import { logAiRun } from "@/lib/ai/log";
import { POLICY_LABEL, RATE_LIMIT, screenQuestion, type PolicyCategory } from "@/lib/ai/policy";
import { encodeSse, SSE_HEARTBEAT } from "@/lib/ai/sse";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_HISTORY_CHARS = 6000;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1)
    .max(100),
});

/** Keep the last N messages, starting with a user turn, each clipped to a sane size. */
function prepareHistory(messages: CopilotMessage[]): CopilotMessage[] {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES).filter((m) => m.content.trim().length > 0);
  while (recent.length && recent[0]!.role !== "user") recent.shift();
  return recent.map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_HISTORY_CHARS) }));
}

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

/** Answers a policy-blocked question without calling the model, and logs it. */
async function policyResponse(userId: string, question: string, category: PolicyCategory, message: string) {
  const runId = crypto.randomUUID();
  await logAiRun({
    id: runId,
    kind: "copilot",
    userId,
    input: question,
    output: message,
    model: null,
    latencyMs: 0,
    status: "blocked",
    error: `Policy: ${category}`,
  });
  const events: CopilotEvent[] = [
    { type: "run", runId },
    { type: "policy", outcome: "blocked", category, label: POLICY_LABEL[category] },
    { type: "text", delta: message },
    { type: "done", latencyMs: 0 },
  ];
  return new Response(events.map(encodeSse).join(""), {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store, no-transform" },
  });
}

/** POST /api/ai/chat — Ops Copilot, streamed as Server-Sent Events of CopilotEvent. */
export async function POST(request: Request) {
  const auth = await authorizeApi(["manager", "admin"]);
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return jsonError(400, "Expected { messages: { role, content }[] }.");

  const history = prepareHistory(parsed.data.messages);
  const last = history.at(-1);
  if (!last || last.role !== "user") return jsonError(400, "The last message must be a question from the user.");

  // Acceptable-use policy, before any model call: injection, write requests, secrets, length…
  const screen = screenQuestion(last.content, MAX_QUESTION_CHARS);
  if (!screen.allowed) return policyResponse(auth.user.id, last.content, screen.category, screen.message);
  // …and a per-user rate limit.
  if ((await recentQuestions(auth.user.id)) >= RATE_LIMIT.max) {
    return policyResponse(
      auth.user.id,
      last.content,
      "rate_limit",
      `You've asked ${RATE_LIMIT.max} questions in the last ${RATE_LIMIT.windowMinutes} minutes. Please wait a few minutes and try again.`,
    );
  }

  // Every tool query runs through this user-scoped client, so RLS applies to the agent.
  const supabase = await createClient();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

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
      const heartbeat = setInterval(() => write(SSE_HEARTBEAT), 15_000);
      try {
        await runCopilot({
          user: auth.user,
          supabase,
          messages: history,
          signal: abort.signal,
          emit: (event: CopilotEvent) => write(encodeSse(event)),
        });
      } finally {
        clearInterval(heartbeat);
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

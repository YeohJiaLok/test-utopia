import { z } from "zod";
import type { CopilotEvent } from "@/lib/ai/contracts";
import { MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "@/lib/ai/catalogue";
import { runCopilot, type CopilotMessage } from "@/lib/ai/copilot";
import { authorizeApi, jsonError } from "@/lib/ai/http";
import { encodeSse, SSE_HEARTBEAT } from "@/lib/ai/sse";
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
  if (last.content.length > MAX_QUESTION_CHARS) {
    return jsonError(413, `Questions are limited to ${MAX_QUESTION_CHARS} characters.`);
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

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiRunKind, AiToolCall } from "@/lib/types";

export interface AiRunLog {
  id?: string;
  kind: AiRunKind;
  userId: string | null;
  input: string | null;
  toolCalls?: AiToolCall[];
  output?: string | null;
  model: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs: number;
  status: "ok" | "error" | "refused" | "blocked";
  error?: string | null;
}

const MAX_TEXT = 8000;

function clip(text: string | null | undefined, max = MAX_TEXT) {
  if (text === null || text === undefined) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Append to the AI governance log (`ai_runs`) with the service-role client so users
 * cannot forge or suppress entries. Never throws: logging must not break the feature.
 * Returns the run id, or null if the write failed.
 */
export async function logAiRun(run: AiRunLog): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_runs")
      .insert({
        ...(run.id ? { id: run.id } : {}),
        kind: run.kind,
        user_id: run.userId,
        input: clip(run.input, 4000),
        tool_calls: run.toolCalls ?? [],
        output: clip(run.output),
        model: run.model,
        input_tokens: run.inputTokens ?? null,
        output_tokens: run.outputTokens ?? null,
        latency_ms: Math.round(run.latencyMs),
        status: run.status,
        error: clip(run.error, 1000),
      })
      .select("id")
      .single();
    if (error) {
      console.error("[ai] failed to log ai_run", error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.error("[ai] failed to log ai_run", err instanceof Error ? err.message : err);
    return null;
  }
}

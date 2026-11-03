import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRange } from "@/lib/time";
import type { AiRun, AiToolCall, AppRole, OrderEvent } from "@/lib/types";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

export interface AuditEvent extends OrderEvent {
  order_no: string | null;
}

export interface AuditRun extends AiRun {
  user_name: string | null;
  user_role: AppRole | null;
}

export interface AuditData {
  events: AuditEvent[];
  runs: AuditRun[];
  week: { runs: number; avgLatencyMs: number | null; tokens: number; errors: number };
}

export async function getAuditData(): Promise<AuditData> {
  const supabase = await createClient();
  const week = getRange("this_week");

  const [events, runs, weekRuns] = await Promise.all([
    supabase.from("order_events").select("*, order:orders(order_no)").order("created_at", { ascending: false }).limit(150),
    supabase.from("ai_runs").select("*, user:profiles(full_name, role)").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("ai_runs")
      .select("latency_ms, input_tokens, output_tokens, status")
      .gte("created_at", week.from)
      .lt("created_at", week.to)
      .limit(10000),
  ]);
  if (events.error) fail("order events", events.error);
  if (runs.error) fail("AI runs", runs.error);

  const w = (weekRuns.data ?? []) as Row[];
  const latencies = w.map((r) => r.latency_ms).filter((v): v is number => v !== null && v !== undefined).map(Number);

  return {
    events: ((events.data ?? []) as Row[]).map((r) => ({
      ...(r as unknown as OrderEvent),
      payload: (r.payload ?? {}) as Record<string, unknown>,
      order_no: (one(r.order as { order_no: string } | null)?.order_no as string | undefined) ?? null,
    })),
    runs: ((runs.data ?? []) as Row[]).map((r) => {
      const user = one(r.user as { full_name: string; role: AppRole } | null);
      return {
        ...(r as unknown as AiRun),
        tool_calls: (Array.isArray(r.tool_calls) ? r.tool_calls : []) as AiToolCall[],
        input_tokens: numOrNull(r.input_tokens),
        output_tokens: numOrNull(r.output_tokens),
        latency_ms: numOrNull(r.latency_ms),
        user_name: user?.full_name ?? null,
        user_role: user?.role ?? null,
      };
    }),
    week: {
      runs: w.length,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : null,
      tokens: w.reduce((s, r) => s + num(r.input_tokens) + num(r.output_tokens), 0),
      errors: w.filter((r) => r.status !== "ok").length,
    },
  };
}

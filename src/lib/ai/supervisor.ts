import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiModel, describeAiError, errorDetail, getAnthropic } from "@/lib/ai/client";
import { logAiRun } from "@/lib/ai/log";
import { SUPERVISOR_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { evaluateRules, normalizeAiCode, type RuleFlag } from "@/lib/ai/rules";
import type { AiToolCall, AttachmentKind, FlagSeverity, OrderStatus, PaymentMethod } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

const AI_REVIEW_LIMIT = 10;
const AI_REVIEW_CONCURRENCY = 3;
const RESCAN_ORDER_LIMIT = 500;
const ID_CHUNK = 100;

const ORDER_SELECT =
  "id, order_no, status, quoted_price, reschedule_count, started_at, completed_at, problem_description, service_type:service_types(code, name), completion:job_completions(work_done, quoted_price, extra_charges, final_amount, remarks, payment_amount, payment_method, completed_at), attachments:order_attachments(kind)";

type Embedded<T> = T | T[] | null;
interface SupervisedOrder {
  id: string;
  order_no: string;
  status: OrderStatus;
  quoted_price: number | string;
  reschedule_count: number;
  started_at: string | null;
  completed_at: string | null;
  problem_description: string;
  service_type: Embedded<{ code: string; name: string }>;
  completion: Embedded<{
    work_done: string;
    quoted_price: number | string;
    extra_charges: number | string;
    final_amount: number | string;
    remarks: string | null;
    payment_amount: number | string | null;
    payment_method: PaymentMethod | null;
    completed_at: string;
  }>;
  attachments: { kind: AttachmentKind }[] | null;
}

function one<T>(value: Embedded<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function rulesFor(order: SupervisedOrder): RuleFlag[] {
  return evaluateRules({ order, completion: one(order.completion), attachments: order.attachments ?? [] });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------ persistence --

/** Upsert current rule findings and retire unresolved rule flags that no longer apply. */
async function persistRuleFlags(admin: Admin, results: { orderId: string; flags: RuleFlag[] }[]) {
  const rows = results.flatMap((r) => r.flags.map((f) => ({ order_id: r.orderId, source: "rule" as const, ...f })));
  for (const part of chunk(rows, 500)) {
    const { error } = await admin.from("ai_flags").upsert(part, { onConflict: "order_id,rule_code" });
    if (error) throw new Error(`ai_flags upsert failed: ${error.message}`);
  }

  const current = new Set(rows.map((r) => `${r.order_id}:${r.rule_code}`));
  for (const ids of chunk(results.map((r) => r.orderId), ID_CHUNK)) {
    const { data, error } = await admin
      .from("ai_flags")
      .select("id, order_id, rule_code")
      .in("order_id", ids)
      .eq("source", "rule")
      .eq("resolved", false);
    if (error) throw new Error(`ai_flags lookup failed: ${error.message}`);
    const stale = ((data ?? []) as { id: string; order_id: string; rule_code: string }[])
      .filter((f) => !current.has(`${f.order_id}:${f.rule_code}`))
      .map((f) => f.id);
    if (stale.length) {
      const del = await admin.from("ai_flags").delete().in("id", stale);
      if (del.error) throw new Error(`ai_flags cleanup failed: ${del.error.message}`);
    }
  }
}

// -------------------------------------------------------------- AI review --

const AiReviewSchema = z.object({
  risk_level: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  flags: z.array(
    z.object({
      code: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      title: z.string(),
      explanation: z.string(),
      recommended_action: z.string(),
    }),
  ),
});
export type AiReview = z.infer<typeof AiReviewSchema>;

/**
 * Ask Claude for a structured judgement of one completed job (problem vs work vs
 * charges). Customer PII is not sent. Logs to ai_runs; returns null on any failure.
 */
async function reviewWithAi(order: SupervisedOrder, ruleFlags: RuleFlag[], userId: string | null): Promise<AiReview | null> {
  const client = getAnthropic();
  if (!client) return null;
  const completion = one(order.completion);
  if (!completion) return null;

  const model = aiModel();
  const started = performance.now();
  const media: Record<string, number> = {};
  for (const a of order.attachments ?? []) media[a.kind] = (media[a.kind] ?? 0) + 1;
  const service = one(order.service_type);
  const hours =
    order.started_at && (completion.completed_at ?? order.completed_at)
      ? Math.round(((Date.parse(completion.completed_at ?? order.completed_at!) - Date.parse(order.started_at)) / 3_600_000) * 10) / 10
      : null;

  const payload = {
    order_no: order.order_no,
    service_type: service ? `${service.code} – ${service.name}` : null,
    problem_reported: order.problem_description,
    quoted_price_myr: Number(order.quoted_price),
    completion: {
      work_done: completion.work_done,
      extra_charges_myr: Number(completion.extra_charges),
      final_amount_myr: Number(completion.final_amount),
      remarks: completion.remarks,
      payment_amount_myr: completion.payment_amount === null ? null : Number(completion.payment_amount),
      payment_method: completion.payment_method,
      hours_from_start_to_completion: hours,
    },
    media_counts: media,
    reschedule_count: order.reschedule_count,
    rule_findings: ruleFlags.map((f) => ({ code: f.rule_code, severity: f.severity, finding: f.explanation })),
  };
  const trace: AiToolCall[] = [{ name: "rules_engine", input: { order_no: order.order_no }, ok: true, rows: ruleFlags.length, ms: 0 }];

  try {
    const response = await client.messages.parse(
      {
        model,
        max_tokens: 4000,
        system: SUPERVISOR_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Review this completed job:\n\n${JSON.stringify(payload, null, 2)}` }],
        output_config: { effort: "low", format: zodOutputFormat(AiReviewSchema) },
      },
      { timeout: 60_000 },
    );
    const latencyMs = performance.now() - started;
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
      await logAiRun({
        kind: "supervisor",
        userId,
        input: order.order_no,
        toolCalls: trace,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
        status: response.stop_reason === "refusal" ? "refused" : "error",
        error: `No structured review (stop_reason: ${response.stop_reason})`,
      });
      return null;
    }
    const review: AiReview = {
      ...response.parsed_output,
      flags: response.parsed_output.flags.slice(0, 3).map((f) => ({
        ...f,
        code: normalizeAiCode(f.code),
        title: f.title.slice(0, 120),
        explanation: f.explanation.slice(0, 1000),
        recommended_action: f.recommended_action.slice(0, 500),
      })),
    };
    await logAiRun({
      kind: "supervisor",
      userId,
      input: order.order_no,
      toolCalls: trace,
      output: JSON.stringify(review),
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      status: "ok",
    });
    return review;
  } catch (err) {
    console.error(`[ai] supervisor review failed for ${order.order_no}:`, describeAiError(err));
    await logAiRun({
      kind: "supervisor",
      userId,
      input: order.order_no,
      toolCalls: trace,
      model,
      latencyMs: performance.now() - started,
      status: "error",
      error: errorDetail(err),
    });
    return null;
  }
}

/** Replace this order's unresolved AI-sourced flags with the latest review. */
async function persistAiFlags(admin: Admin, orderId: string, review: AiReview, model: string) {
  const del = await admin.from("ai_flags").delete().eq("order_id", orderId).eq("source", "ai").eq("resolved", false);
  if (del.error) throw new Error(`ai_flags cleanup failed: ${del.error.message}`);
  if (!review.flags.length) return;
  const rows = review.flags.map((f) => ({
    order_id: orderId,
    rule_code: f.code,
    severity: f.severity as FlagSeverity,
    source: "ai" as const,
    title: f.title,
    explanation: f.explanation,
    recommended_action: f.recommended_action,
    evidence: { risk_level: review.risk_level, summary: review.summary, model },
  }));
  const { error } = await admin.from("ai_flags").upsert(rows, { onConflict: "order_id,rule_code" });
  if (error) throw new Error(`ai_flags upsert failed: ${error.message}`);
}

async function superviseWithAi(admin: Admin, order: SupervisedOrder, ruleFlags: RuleFlag[], userId: string | null): Promise<number> {
  const review = await reviewWithAi(order, ruleFlags, userId);
  if (!review) return 0;
  await persistAiFlags(admin, order.id, review, aiModel());
  return review.flags.length;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

// ----------------------------------------------------------- entry points --

/**
 * Supervise one order after it is completed: deterministic rules, then (when an API
 * key is configured) a structured Claude review. Writes ai_flags and ai_runs with the
 * service-role client. Never throws — it runs inside `after()`.
 */
export async function runSupervisor(orderId: string): Promise<void> {
  const started = performance.now();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
    if (error) throw new Error(`order lookup failed: ${error.message}`);
    const order = data as unknown as SupervisedOrder | null;
    if (!order || !one(order.completion)) return;

    const flags = rulesFor(order);
    await persistRuleFlags(admin, [{ orderId: order.id, flags }]);

    if (getAnthropic()) {
      await superviseWithAi(admin, order, flags, null);
    } else {
      await logAiRun({
        kind: "supervisor",
        userId: null,
        input: order.order_no,
        toolCalls: [{ name: "rules_engine", input: { order_no: order.order_no }, ok: true, rows: flags.length, ms: Math.round(performance.now() - started) }],
        output: JSON.stringify({ rule_flags: flags.map((f) => f.rule_code), ai_review: "skipped (no API key)" }),
        model: null,
        latencyMs: performance.now() - started,
        status: "ok",
      });
    }
  } catch (err) {
    console.error(`[ai] runSupervisor(${orderId}) failed`, err);
  }
}

/**
 * Re-run the rules over every order awaiting review (job_done) and a fresh AI review
 * for the most recent ones. Caller must have authorised the user.
 */
export async function rescanAllFlags(userId: string): Promise<{ scanned: number; flagged: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "job_done")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(RESCAN_ORDER_LIMIT);
  if (error) throw new Error(`order scan failed: ${error.message}`);
  const orders = ((data ?? []) as unknown as SupervisedOrder[]).filter((o) => one(o.completion));

  const results = orders.map((o) => ({ order: o, flags: rulesFor(o) }));
  await persistRuleFlags(
    admin,
    results.map((r) => ({ orderId: r.order.id, flags: r.flags })),
  );

  const flaggedIds = new Set(results.filter((r) => r.flags.length).map((r) => r.order.id));
  if (getAnthropic()) {
    const recent = results.slice(0, AI_REVIEW_LIMIT);
    const counts = await mapWithConcurrency(recent, AI_REVIEW_CONCURRENCY, async (r) => {
      try {
        return await superviseWithAi(admin, r.order, r.flags, userId);
      } catch (err) {
        console.error(`[ai] AI review failed for ${r.order.order_no}`, err);
        return 0;
      }
    });
    recent.forEach((r, i) => {
      if ((counts[i] ?? 0) > 0) flaggedIds.add(r.order.id);
    });
  }

  return { scanned: orders.length, flagged: flaggedIds.size };
}

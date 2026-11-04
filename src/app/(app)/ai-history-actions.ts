"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RETENTION_DAYS } from "@/lib/ai/conversations";
import type { ChartSpec } from "@/lib/ai/contracts";

// Sejuk Ops AI conversation history. Everything runs as the signed-in user: row-level security
// limits it to their own conversations (and to office roles that passed 2FA). Deleting history
// never touches the AI audit log (ai_runs).

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  status: "done" | "error" | "stopped";
  steps: unknown[];
  charts: ChartSpec[];
  records: { orderNo: string; orderId: string; label: string }[];
  policy: { outcome: "blocked" | "refused"; category: string; label: string } | null;
  error: string | null;
  latencyMs: number | null;
  runId: string | null;
  createdAt: string;
}

const id = z.uuid();
const retentionCutoff = () => new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();

export async function listConversations(search?: string): Promise<ConversationSummary[]> {
  await requireUser(["admin", "manager"]);
  const supabase = await createClient();
  let q = supabase
    .from("ai_conversations")
    .select("id, title, message_count, created_at, updated_at")
    .gte("updated_at", retentionCutoff())
    .order("updated_at", { ascending: false })
    .limit(100);
  const term = (search ?? "").replace(/[%,()*\\]/g, "").trim().slice(0, 80);
  if (term) q = q.ilike("title", `%${term}%`);
  const { data, error } = await q;
  if (error) throw new Error("Could not load your conversations.");
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    messageCount: c.message_count,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function getConversation(conversationId: string): Promise<{ conversation: ConversationSummary; messages: StoredMessage[] } | null> {
  await requireUser(["admin", "manager"]);
  if (!id.safeParse(conversationId).success) return null;
  const supabase = await createClient();
  const [{ data: c }, { data: rows }] = await Promise.all([
    supabase.from("ai_conversations").select("id, title, message_count, created_at, updated_at").eq("id", conversationId).gte("updated_at", retentionCutoff()).maybeSingle(),
    supabase
      .from("ai_messages")
      .select("id, role, content, status, steps, charts, records, policy, error, latency_ms, run_id, created_at")
      .eq("conversation_id", conversationId)
      .order("id", { ascending: true })
      .limit(200),
  ]);
  if (!c) return null;
  return {
    conversation: { id: c.id, title: c.title, messageCount: c.message_count, createdAt: c.created_at, updatedAt: c.updated_at },
    messages: (rows ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      status: m.status,
      steps: m.steps ?? [],
      charts: m.charts ?? [],
      records: m.records ?? [],
      policy: m.policy,
      error: m.error,
      latencyMs: m.latency_ms,
      runId: m.run_id,
      createdAt: m.created_at,
    })),
  };
}

const renameSchema = z.object({ id, title: z.string().trim().min(1, "Enter a title").max(120, "Keep the title under 120 characters") });

export async function renameConversation(conversationId: string, title: string): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  await requireUser(["admin", "manager"]);
  const parsed = renameSchema.safeParse({ id: conversationId, title });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid title" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_conversations").update({ title: parsed.data.title }).eq("id", parsed.data.id).select("title");
  if (error || !data?.length) return { ok: false, error: "Could not rename this conversation." };
  return { ok: true, title: data[0]!.title };
}

export async function deleteConversation(conversationId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser(["admin", "manager"]);
  if (!id.safeParse(conversationId).success) return { ok: false, error: "Not found" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_conversations").delete().eq("id", conversationId).select("id");
  if (error || !data?.length) return { ok: false, error: "Could not delete this conversation." };
  return { ok: true };
}

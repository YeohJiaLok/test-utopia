import { EVENT_LABELS } from "@/lib/workflow";
import type { AuditRole, AuditTab, AiStatus } from "./filters";

/** Human labels shared by the page, the search matcher and the CSV export. */
export const TAB_LABELS: Record<AuditTab, { label: string; short: string; noun: string }> = {
  events: { label: "Order events", short: "Orders", noun: "events" },
  ai: { label: "AI runs", short: "AI", noun: "runs" },
  users: { label: "User management", short: "Users", noun: "changes" },
};

export const AI_KIND_LABELS: Record<string, string> = {
  copilot: "Copilot question",
  supervisor: "Supervisor scan",
  extraction: "Document extraction",
  insight: "Insight briefing",
};

export const USER_ACTION_LABELS: Record<string, string> = {
  user_created: "User created",
  user_updated: "User updated",
  role_changed: "Role changed",
  user_deactivated: "User deactivated",
  user_reactivated: "User reactivated",
  password_reset: "Password reset",
  mfa_enabled: "2FA turned on",
  mfa_disabled: "2FA turned off",
  mfa_reset: "2FA reset by admin",
};

export const ROLE_LABELS: Record<AuditRole, string> = {
  admin: "Admin",
  manager: "Manager",
  technician: "Technician",
  system: "System",
};

export const AI_STATUS_LABELS: Record<AiStatus, string> = {
  ok: "Succeeded",
  error: "Error",
  refused: "Refused",
  blocked: "Blocked",
};

export function actionLabel(tab: AuditTab, action: string) {
  const map = tab === "events" ? EVENT_LABELS : tab === "ai" ? AI_KIND_LABELS : USER_ACTION_LABELS;
  return map[action] ?? action.replace(/_/g, " ");
}

/** Action keys whose key or label contains the search term (so "rework" finds rework_requested). */
export function actionsMatching(tab: AuditTab, keys: readonly string[], term: string) {
  const t = term.toLowerCase();
  if (t.length < 3) return [];
  return keys.filter((k) => k.includes(t.replace(/\s+/g, "_")) || actionLabel(tab, k).toLowerCase().includes(t));
}

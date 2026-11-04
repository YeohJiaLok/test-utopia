import {
  BadgeCheck,
  Bot,
  CalendarClock,
  CircleCheck,
  FilePlus2,
  FileScan,
  KeyRound,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  XCircle,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  UserCheck,
  UserCog,
  UserPen,
  UserPlus,
  UserRoundCog,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { TONE_CLASSES } from "@/components/shared/status-badge";
import type { StatusTone } from "@/lib/workflow";
import type { AppRole } from "@/lib/types";
import type { AuditTab, AiStatus } from "@/app/(app)/audit/_lib/filters";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const TAB_ICONS: Record<AuditTab, LucideIcon> = { events: ScrollText, ai: Bot, users: UserCog };

interface ActionMeta {
  icon: LucideIcon;
  tone: StatusTone;
}

const EVENT_META: Record<string, ActionMeta> = {
  order_created: { icon: FilePlus2, tone: "blue" },
  technician_assigned: { icon: UserPlus, tone: "blue" },
  technician_reassigned: { icon: UserRoundCog, tone: "violet" },
  job_started: { icon: Play, tone: "amber" },
  job_completed: { icon: CircleCheck, tone: "teal" },
  job_reviewed: { icon: BadgeCheck, tone: "green" },
  rework_requested: { icon: RotateCcw, tone: "red" },
  job_resubmitted: { icon: CircleCheck, tone: "teal" },
  status_migrated: { icon: ScrollText, tone: "slate" },
  job_closed: { icon: Lock, tone: "slate" },
  job_rescheduled: { icon: CalendarClock, tone: "amber" },
  order_cancelled: { icon: XCircle, tone: "red" },
};

const AI_META: Record<string, ActionMeta> = {
  copilot: { icon: Sparkles, tone: "violet" },
  supervisor: { icon: ShieldAlert, tone: "amber" },
  extraction: { icon: FileScan, tone: "blue" },
  insight: { icon: Lightbulb, tone: "teal" },
};

const USER_META: Record<string, ActionMeta> = {
  user_created: { icon: UserPlus, tone: "green" },
  user_updated: { icon: UserPen, tone: "blue" },
  role_changed: { icon: ShieldCheck, tone: "violet" },
  user_deactivated: { icon: UserX, tone: "red" },
  user_reactivated: { icon: UserCheck, tone: "green" },
  password_reset: { icon: KeyRound, tone: "amber" },
  mfa_enabled: { icon: ShieldCheck, tone: "green" },
  mfa_disabled: { icon: ShieldOff, tone: "amber" },
  mfa_reset: { icon: ShieldOff, tone: "red" },
};

export function actionMeta(tab: AuditTab, action: string): ActionMeta {
  const map = tab === "events" ? EVENT_META : tab === "ai" ? AI_META : USER_META;
  return map[action] ?? { icon: ScrollText, tone: "slate" };
}

/** Database function that writes each order event (shown as the event's source). */
export const EVENT_SOURCE: Record<string, string> = {
  order_created: "create_order()",
  technician_assigned: "assign_technician()",
  technician_reassigned: "assign_technician()",
  job_started: "start_job()",
  job_completed: "complete_job()",
  job_reviewed: "review_job()",
  rework_requested: "review_job()",
  job_resubmitted: "complete_job()",
  status_migrated: "migration",
  job_closed: "close_job()",
  job_rescheduled: "reschedule_order()",
  order_cancelled: "cancel_order()",
};

export function ActionIcon({ tab, action, className }: { tab: AuditTab; action: string; className?: string }) {
  const meta = actionMeta(tab, action);
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
        TONE_CLASSES[meta.tone].badge,
        className,
      )}
      aria-hidden
    >
      <meta.icon className="size-4" />
    </span>
  );
}

const ROLE_TONE: Record<AppRole | "system", StatusTone> = {
  admin: "violet",
  manager: "blue",
  technician: "green",
  system: "slate",
};

export function RoleChip({ role, className }: { role: AppRole | null; className?: string }) {
  const r = role ?? "system";
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[10.5px] font-semibold tracking-wide uppercase ring-1 ring-inset",
        TONE_CLASSES[ROLE_TONE[r]].badge,
        className,
      )}
    >
      {r === "technician" ? "Tech" : r}
    </span>
  );
}

export function ActorAvatar({ name, role, className }: { name: string | null; role: AppRole | null; className?: string }) {
  if (!name)
    return (
      <span
        className={cn("bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full", className)}
        aria-hidden
      >
        <Bot className="size-3.5" />
      </span>
    );
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset",
        TONE_CLASSES[ROLE_TONE[role ?? "system"]].badge,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Avatar + name + role chip, truncating safely inside narrow columns. */
export function Actor({ name, role, className }: { name: string | null; role: AppRole | null; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ActorAvatar name={name} role={role} />
      <span className="min-w-0 truncate text-sm font-medium">{name ?? "System"}</span>
      <RoleChip role={role} />
    </span>
  );
}

export const RUN_STATUS_TONE: Record<AiStatus, StatusTone> = {
  ok: "green",
  error: "red",
  refused: "amber",
  blocked: "red",
};

export function Pill({ tone, className, children }: { tone: StatusTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASSES[tone].badge,
        className,
      )}
    >
      {children}
    </span>
  );
}

export const show = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

export const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`);

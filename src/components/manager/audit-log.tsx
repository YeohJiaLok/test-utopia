"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bot, ChevronDown, ScrollText, UserCog, Wrench } from "lucide-react";
import { EASE } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuditEvent, AuditRun, UserAdminEvent } from "@/app/(app)/audit/_lib/queries";
import type { AppRole } from "@/lib/types";
import { EVENT_LABELS } from "@/lib/workflow";
import { orderHref } from "@/lib/routes";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_TONE: Record<AppRole, string> = {
  admin: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  manager: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  technician: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

const RUN_STATUS: Record<AuditRun["status"], string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  error: "bg-red-500/10 text-red-700 dark:text-red-300",
  refused: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  blocked: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const KIND_LABEL: Record<AuditRun["kind"], string> = {
  copilot: "Copilot",
  supervisor: "Supervisor",
  extraction: "Extraction",
  insight: "Insight",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", className)}>{children}</span>;
}

const TH = "text-muted-foreground px-3 py-2 text-left text-[11px] font-medium tracking-wide whitespace-nowrap uppercase";
const TD = "px-3 py-2.5 align-middle";

function EventsTable({ events, viewerRole }: { events: AuditEvent[]; viewerRole: AppRole }) {
  const [action, setAction] = useState("all");
  const [role, setRole] = useState("all");
  const actions = useMemo(() => [...new Set(events.map((e) => e.action))].sort(), [events]);
  const rows = events.filter((e) => (action === "all" || e.action === action) && (role === "all" || (e.actor_role ?? "system") === role));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-52">
          <NativeSelect aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {EVENT_LABELS[a] ?? a}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-40">
          <NativeSelect aria-label="Filter by actor role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="technician">Technician</option>
            <option value="system">System</option>
          </NativeSelect>
        </div>
        <span className="text-muted-foreground ml-auto text-xs" aria-live="polite">
          {rows.length} of {events.length} events
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events match" description="Adjust the filters to see more of the audit trail." />
      ) : (
        <div className="bg-card scrollbar-thin overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className={TH}>When</th>
                <th className={TH}>Order</th>
                <th className={TH}>Action</th>
                <th className={TH}>Actor</th>
                <th className={TH}>Transition</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((e, i) => (
                <motion.tr
                  key={e.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 20) * 0.015 }}
                  className="hover:bg-muted/30"
                >
                  <td className={cn(TD, "text-muted-foreground tabular text-xs whitespace-nowrap")}>
                    <time dateTime={e.created_at} title={formatDateTime(e.created_at)}>
                      {formatRelative(e.created_at)}
                    </time>
                  </td>
                  <td className={TD}>
                    <Link href={orderHref(viewerRole, e.order_id)} className="hover:text-primary font-mono text-xs font-medium">
                      {e.order_no ?? e.order_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className={cn(TD, "font-medium whitespace-nowrap")}>{EVENT_LABELS[e.action] ?? e.action}</td>
                  <td className={TD}>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {e.actor_name ?? "System"}
                      {e.actor_role && <Pill className={ROLE_TONE[e.actor_role]}>{e.actor_role}</Pill>}
                    </span>
                  </td>
                  <td className={TD}>
                    {e.to_status ? (
                      <span className="flex items-center gap-1.5">
                        {e.from_status ? (
                          <StatusBadge status={e.from_status} pulse={false} className="h-5 px-2 text-[11px]" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-label="to" />
                        <StatusBadge status={e.to_status} pulse={false} className="h-5 px-2 text-[11px]" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">No status change</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunsTable({ runs }: { runs: AuditRun[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState("all");
  const rows = runs.filter((r) => kind === "all" || r.kind === kind);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <NativeSelect aria-label="Filter by run kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All kinds</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <span className="text-muted-foreground ml-auto text-xs">Latest {runs.length} runs · click a row for tool calls and output</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Bot} title="No AI runs recorded" description="Copilot questions, supervisor scans and document extractions will be logged here." />
      ) : (
        <div className="bg-card scrollbar-thin overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className={cn(TH, "w-8")}>
                  <span className="sr-only">Expand</span>
                </th>
                <th className={TH}>When</th>
                <th className={TH}>Kind</th>
                <th className={TH}>User</th>
                <th className={TH}>Input</th>
                <th className={cn(TH, "text-right")}>Tools</th>
                <th className={cn(TH, "text-right")}>Tokens in / out</th>
                <th className={cn(TH, "text-right")}>Latency</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expanded = open === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={cn("hover:bg-muted/30 cursor-pointer border-b", expanded && "bg-muted/30")}
                      onClick={() => setOpen(expanded ? null : r.id)}
                    >
                      <td className={TD}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`run-${r.id}`}
                          aria-label={expanded ? "Collapse run details" : "Expand run details"}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setOpen(expanded ? null : r.id);
                          }}
                          className="hover:bg-muted flex size-6 items-center justify-center rounded-md"
                        >
                          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                        </button>
                      </td>
                      <td className={cn(TD, "text-muted-foreground tabular text-xs whitespace-nowrap")}>
                        <time dateTime={r.created_at} title={formatDateTime(r.created_at)}>
                          {formatRelative(r.created_at)}
                        </time>
                      </td>
                      <td className={TD}>
                        <Pill className="bg-primary/8 text-primary">{KIND_LABEL[r.kind] ?? r.kind}</Pill>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap")}>{r.user_name ?? <span className="text-muted-foreground">System</span>}</td>
                      <td className={cn(TD, "max-w-[280px]")}>
                        <span className="text-muted-foreground line-clamp-1 text-xs">{r.input ?? "—"}</span>
                      </td>
                      <td className={cn(TD, "tabular text-right")}>
                        <span className="inline-flex items-center gap-1">
                          <Wrench className="text-muted-foreground size-3" aria-hidden />
                          {r.tool_calls.length}
                        </span>
                      </td>
                      <td className={cn(TD, "tabular text-right text-xs whitespace-nowrap")}>
                        {r.input_tokens !== null ? formatNumber(r.input_tokens) : "—"} / {r.output_tokens !== null ? formatNumber(r.output_tokens) : "—"}
                      </td>
                      <td className={cn(TD, "tabular text-right text-xs whitespace-nowrap")}>
                        {r.latency_ms !== null ? `${(r.latency_ms / 1000).toFixed(1)} s` : "—"}
                      </td>
                      <td className={TD}>
                        <Pill className={RUN_STATUS[r.status]}>{r.status}</Pill>
                      </td>
                    </tr>
                    <tr id={`run-${r.id}`} className={cn(!expanded && "hidden")}>
                      <td colSpan={9} className="border-b p-0">
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: EASE }}
                              className="overflow-hidden"
                            >
                              <div className="bg-muted/20 grid gap-4 p-4 lg:grid-cols-2">
                                <div className="min-w-0 space-y-2">
                                  <p className="text-xs font-semibold">Input</p>
                                  <pre className="bg-background max-h-40 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                                    {r.input ?? "—"}
                                  </pre>
                                  <p className="text-xs font-semibold">
                                    Tool calls <span className="text-muted-foreground font-normal">({r.tool_calls.length})</span>
                                  </p>
                                  {r.tool_calls.length ? (
                                    <ul className="space-y-1.5">
                                      {r.tool_calls.map((t, i) => (
                                        <li key={i} className="bg-background rounded-lg border p-2 text-xs">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono font-medium">{t.name}</span>
                                            <Pill className={t.ok ? RUN_STATUS.ok : RUN_STATUS.error}>{t.ok ? "ok" : "failed"}</Pill>
                                            {t.rows !== undefined && <span className="text-muted-foreground">{t.rows} rows</span>}
                                            {t.ms !== undefined && <span className="text-muted-foreground">{t.ms} ms</span>}
                                          </div>
                                          <pre className="text-muted-foreground mt-1 overflow-x-auto font-mono text-[11px]">
                                            {JSON.stringify(t.input, null, 2)}
                                          </pre>
                                          {t.error && <p className="text-destructive mt-1">{t.error}</p>}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-muted-foreground text-xs">No tools were called.</p>
                                  )}
                                </div>
                                <div className="min-w-0 space-y-2">
                                  <p className="text-xs font-semibold">
                                    Output {r.model && <span className="text-muted-foreground font-mono font-normal">· {r.model}</span>}
                                  </p>
                                  <pre className="bg-background max-h-80 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                                    {r.output ?? "—"}
                                  </pre>
                                  {r.error && (
                                    <p className="rounded-lg bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">{r.error}</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const USER_ACTION: Record<UserAdminEvent["action"], { label: string; tone: string }> = {
  user_created: { label: "User created", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  user_updated: { label: "User updated", tone: "bg-primary/8 text-primary" },
  role_changed: { label: "Role changed", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  user_deactivated: { label: "Deactivated", tone: "bg-red-500/10 text-red-700 dark:text-red-300" },
  user_reactivated: { label: "Reactivated", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  password_reset: { label: "Password reset", tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300" },
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

function UserEventsTable({ events }: { events: UserAdminEvent[] }) {
  const [action, setAction] = useState("all");
  const rows = events.filter((e) => action === "all" || e.action === action);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-52">
          <NativeSelect aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">All actions</option>
            {Object.entries(USER_ACTION).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <span className="text-muted-foreground ml-auto text-xs" aria-live="polite">
          {rows.length} of {events.length} changes · passwords are never recorded
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={UserCog} title="No user changes yet" description="Accounts created, role changes, deactivations and password resets appear here." />
      ) : (
        <div className="bg-card scrollbar-thin overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className={TH}>When</th>
                <th className={TH}>Action</th>
                <th className={TH}>User</th>
                <th className={TH}>Changes</th>
                <th className={TH}>By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30 align-top">
                  <td className={cn(TD, "text-muted-foreground tabular text-xs whitespace-nowrap")}>
                    <time dateTime={e.created_at} title={formatDateTime(e.created_at)}>
                      {formatRelative(e.created_at)}
                    </time>
                  </td>
                  <td className={TD}>
                    <Pill className={USER_ACTION[e.action]?.tone}>{USER_ACTION[e.action]?.label ?? e.action}</Pill>
                  </td>
                  <td className={TD}>
                    <span className="block font-medium whitespace-nowrap">{e.target_name}</span>
                    {e.target_email && <span className="text-muted-foreground block text-xs">{e.target_email}</span>}
                  </td>
                  <td className={TD}>
                    {Object.keys(e.changes).length ? (
                      <ul className="space-y-0.5 text-xs">
                        {Object.entries(e.changes).map(([field, c]) => (
                          <li key={field} className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground capitalize">{field}</span>
                            {c.from !== null && c.from !== undefined && (
                              <>
                                <span>{show(c.from)}</span>
                                <ArrowRight className="text-muted-foreground size-3" aria-label="to" />
                              </>
                            )}
                            <span className="font-medium">{show(c.to)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className={cn(TD, "whitespace-nowrap")}>{e.actor_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AuditLog({
  events,
  runs,
  userEvents,
  viewerRole,
}: {
  events: AuditEvent[];
  runs: AuditRun[];
  userEvents: UserAdminEvent[];
  viewerRole: AppRole;
}) {
  return (
    <Tabs defaultValue="events" className="gap-4">
      <TabsList>
        <TabsTrigger value="events" className="px-3">
          <ScrollText /> Order events <span className="text-muted-foreground tabular text-xs">{events.length}</span>
        </TabsTrigger>
        <TabsTrigger value="runs" className="px-3">
          <Bot /> AI runs <span className="text-muted-foreground tabular text-xs">{runs.length}</span>
        </TabsTrigger>
        <TabsTrigger value="users" className="px-3">
          <UserCog /> User management <span className="text-muted-foreground tabular text-xs">{userEvents.length}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="events">
        <EventsTable events={events} viewerRole={viewerRole} />
      </TabsContent>
      <TabsContent value="runs">
        <RunsTable runs={runs} />
      </TabsContent>
      <TabsContent value="users">
        <UserEventsTable events={userEvents} />
      </TabsContent>
    </Tabs>
  );
}

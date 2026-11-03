"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, ChevronRight, Lock, Wrench } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { EASE } from "@/components/motion";
import type { AuditPageData, AuditEventRow, AuditRunRow, UserAdminEventRow } from "@/app/(app)/audit/_lib/types";
import { auditHref, dayLabel, groupByDay, type AuditTab } from "@/app/(app)/audit/_lib/filters";
import { AI_STATUS_LABELS, TAB_LABELS } from "@/app/(app)/audit/_lib/labels";
import type { AppRole } from "@/lib/types";
import { orderHref } from "@/lib/routes";
import { formatDateTime, formatNumber, formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AuditDetail, entryTitle, type AuditEntry } from "./audit-detail";
import { AuditPagination } from "./audit-pagination";
import { AuditVolume } from "./audit-summary";
import { ActionIcon, Actor, Pill, RUN_STATUS_TONE, TAB_ICONS, seconds, show } from "./meta";
import { summarizePayload } from "./summarize";
import { useAuditNav } from "./audit-nav";

const GRID = "md:grid md:grid-cols-[6.25rem_minmax(0,1.15fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,1.5fr)_1rem] md:items-center md:gap-4";

const COLUMNS: Record<AuditTab, [string, string, string, string]> = {
  events: ["Action", "Actor", "Order", "Change"],
  ai: ["Kind", "User", "Input", "Result"],
  users: ["Action", "Changed by", "Account", "Changes"],
};

function toEntries(data: AuditPageData): AuditEntry[] {
  switch (data.tab) {
    case "events":
      return data.rows.map((row) => ({ tab: "events", row }));
    case "ai":
      return data.rows.map((row) => ({ tab: "ai", row }));
    case "users":
      return data.rows.map((row) => ({ tab: "users", row }));
  }
}

function TimeCell({ at }: { at: string }) {
  return (
    <time dateTime={at} title={`${formatDateTime(at)} MYT`} className="tabular shrink-0 text-xs whitespace-nowrap">
      <span className="text-foreground font-medium">{formatTime(at)}</span>
      <span className="text-muted-foreground hidden md:block" suppressHydrationWarning>
        {formatRelative(at)}
      </span>
    </time>
  );
}

function OrderLink({ row, viewerRole }: { row: AuditEventRow; viewerRole: AppRole }) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        href={orderHref(viewerRole, row.order_id)}
        className="text-foreground hover:text-primary pointer-events-auto relative z-10 w-fit max-w-full truncate font-mono text-xs font-semibold hover:underline"
      >
        {row.order_no ?? row.order_id.slice(0, 8)}
      </Link>
      {row.customer_name && <span className="text-muted-foreground truncate text-xs">{row.customer_name}</span>}
    </span>
  );
}

function Transition({ row }: { row: AuditEventRow }) {
  const summary = summarizePayload(row.action, row.payload);
  // Same-status events (e.g. a reschedule) are better described by what they carried.
  if (row.to_status && !(row.from_status === row.to_status && summary))
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        {row.from_status && <StatusBadge status={row.from_status} pulse={false} className="h-5 px-2 text-[11px]" />}
        {row.from_status && <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-label="to" />}
        <StatusBadge status={row.to_status} pulse={false} className="h-5 px-2 text-[11px]" />
      </span>
    );
  return <span className="text-muted-foreground line-clamp-2 text-xs">{summary ?? "No status change"}</span>;
}

function RunResult({ row }: { row: AuditRunRow }) {
  const tokens = (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tabular">
      <Pill tone={RUN_STATUS_TONE[row.status]}>{AI_STATUS_LABELS[row.status]}</Pill>
      <span className="inline-flex items-center gap-1" title="Tool calls">
        <Wrench className="size-3" aria-hidden />
        {row.tool_calls.length}
      </span>
      {tokens > 0 && <span title="Tokens in + out">{formatNumber(tokens)} tok</span>}
      <span title="Latency">{seconds(row.latency_ms)}</span>
    </span>
  );
}

function ChangesSummary({ row }: { row: UserAdminEventRow }) {
  const entries = Object.entries(row.changes ?? {});
  if (!entries.length) return <span className="text-muted-foreground text-xs">—</span>;
  const [field, c] = entries[0]!;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <span className="text-muted-foreground shrink-0 capitalize">{field.replace(/_/g, " ")}</span>
      {c.from !== null && c.from !== undefined && (
        <>
          <span className="truncate line-through decoration-red-500/40">{show(c.from)}</span>
          <ArrowRight className="text-muted-foreground size-3 shrink-0" aria-label="to" />
        </>
      )}
      <span className="truncate font-medium">{show(c.to)}</span>
      {entries.length > 1 && <span className="text-muted-foreground shrink-0">+{entries.length - 1}</span>}
    </span>
  );
}

/** The four content cells of a row (action, actor, target, detail) for each kind of entry. */
function cells(entry: AuditEntry, viewerRole: AppRole) {
  switch (entry.tab) {
    case "events": {
      const r = entry.row;
      return {
        action: r.action,
        actor: <Actor name={r.actor_name} role={r.actor_role} />,
        target: <OrderLink row={r} viewerRole={viewerRole} />,
        detail: <Transition row={r} />,
      };
    }
    case "ai": {
      const r = entry.row;
      return {
        action: r.kind,
        actor: <Actor name={r.user_name} role={r.user_role} />,
        target: <span className="text-muted-foreground line-clamp-2 text-xs break-words">{r.input ?? "—"}</span>,
        detail: <RunResult row={r} />,
      };
    }
    case "users": {
      const r = entry.row;
      return {
        action: r.action,
        actor: <Actor name={r.actor_name} role={r.actor_role} />,
        target: (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{r.target_name}</span>
            {r.target_email && <span className="text-muted-foreground truncate text-xs">{r.target_email}</span>}
          </span>
        ),
        detail: <ChangesSummary row={r} />,
      };
    }
  }
}

function Row({
  entry,
  viewerRole,
  selected,
  index,
  onOpen,
}: {
  entry: AuditEntry;
  viewerRole: AppRole;
  selected: boolean;
  index: number;
  onOpen: () => void;
}) {
  const c = cells(entry, viewerRole);
  const title = entryTitle(entry);
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: Math.min(index, 18) * 0.018 }}
      className={cn("group relative transition-colors", selected ? "bg-primary/5" : "hover:bg-muted/40")}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring/60 absolute inset-0 z-0 w-full rounded-none outline-none focus-visible:ring-2 focus-visible:ring-inset"
        aria-label={`View details: ${title}, ${formatDateTime(entry.row.created_at)}`}
      />
      {selected && <span className="bg-primary absolute inset-y-0 left-0 w-0.5" aria-hidden />}

      {/* Mobile: stacked card */}
      <div className="pointer-events-none relative flex gap-3 px-4 py-3 md:hidden">
        <ActionIcon tab={entry.tab} action={c.action} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
            <TimeCell at={entry.row.created_at} />
          </div>
          <div className="min-w-0">{c.actor}</div>
          <div className="min-w-0">{c.target}</div>
          <div className="min-w-0">{c.detail}</div>
        </div>
      </div>

      {/* Desktop: aligned columns */}
      <div className={cn("pointer-events-none relative hidden px-4 py-2.5", GRID)}>
        <TimeCell at={entry.row.created_at} />
        <div className="flex min-w-0 items-center gap-2.5">
          <ActionIcon tab={entry.tab} action={c.action} className="size-7 [&_svg]:size-3.5" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <div className="min-w-0">{c.actor}</div>
        <div className="min-w-0">{c.target}</div>
        <div className="min-w-0">{c.detail}</div>
        <ChevronRight className="text-muted-foreground/60 group-hover:text-foreground size-4 transition-colors" aria-hidden />
      </div>
    </motion.li>
  );
}

export function AuditFeed({ data, viewerRole }: { data: AuditPageData; viewerRole: AppRole }) {
  const entries = useMemo(() => toEntries(data), [data]);
  const groups = useMemo(() => groupByDay(entries.map((e, i) => ({ created_at: e.row.created_at, i }))), [entries]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [lastIndex, setLastIndex] = useState(0);
  const { go } = useAuditNav();
  const f = data.filters;
  const noun = TAB_LABELS[data.tab].noun;
  const filtered = !!(f.q || f.action || f.role || f.status);

  // Reset the drawer when the page of results changes.
  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setOpenIndex(null);
  }

  const open = (i: number) => {
    setOpenIndex(i);
    setLastIndex(i);
  };
  const shown = entries[openIndex ?? lastIndex] ?? null;

  if (!entries.length) {
    const Icon = TAB_ICONS[data.tab];
    const clearHref = auditHref(f, { q: "", action: "", role: "", status: "", range: filtered ? f.range : "all" });
    return (
      <EmptyState
        icon={Icon}
        title={filtered ? `No ${noun} match these filters` : `No ${noun} in ${data.range.label.toLowerCase()}`}
        description={
          data.tab === "ai"
            ? "Copilot questions, supervisor scans and document extractions are logged here with their tool calls."
            : data.tab === "users"
              ? "Accounts created, role changes, deactivations and password resets are recorded here."
              : "Every workflow transition is written here by the database."
        }
        action={
          filtered || f.range !== "all" ? (
            <button
              type="button"
              onClick={() => go(clearHref)}
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              {filtered ? "Clear filters" : "Show all time"}
            </button>
          ) : undefined
        }
        className="bg-card"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border">
        {data.volume.buckets.length > 1 && (
          <div className="border-b px-4 pt-3 pb-3">
            <AuditVolume buckets={data.volume.buckets} unit={data.volume.unit} noun={noun} />
          </div>
        )}

        <div
          className={cn(
            "text-muted-foreground bg-muted/30 hidden border-b px-4 py-2 text-[11px] font-medium tracking-wider uppercase",
            GRID,
          )}
          aria-hidden
        >
          <span>Time</span>
          {COLUMNS[data.tab].map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span />
        </div>

        {groups.map((g, gi) => (
          <section key={g.key} aria-label={dayLabel(g.key)}>
            <h2
              className={cn(
                "bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-14 z-20 flex items-center justify-between gap-2 border-b px-4 py-1.5 text-xs backdrop-blur-md",
                gi > 0 && "border-t",
              )}
            >
              <span className="font-semibold" suppressHydrationWarning>
                {dayLabel(g.key)}
              </span>
              <span className="text-muted-foreground tabular">
                {g.rows.length} {g.rows.length === 1 ? noun.replace(/s$/, "") : noun}
              </span>
            </h2>
            <ul className="divide-y">
              {g.rows.map(({ i }) => (
                <Row
                  key={`${data.page}-${i}`}
                  entry={entries[i]!}
                  index={i}
                  viewerRole={viewerRole}
                  selected={openIndex === i}
                  onOpen={() => open(i)}
                />
              ))}
            </ul>
          </section>
        ))}

        <div className="text-muted-foreground flex items-start gap-2 rounded-b-xl border-t px-4 py-3 text-[11px]">
          <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
          <p>
            Append-only ledger. Entries are written by database functions and server processes; no user, including admins, can edit
            or delete them. Times are Malaysia time (MYT).
          </p>
        </div>
      </div>

      <AuditPagination filters={f} total={data.total} pages={data.pages} noun={noun} />

      <Sheet open={openIndex !== null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
          aria-describedby={undefined}
        >
          {shown && (
            <AuditDetail
              entry={shown}
              viewerRole={viewerRole}
              position={{ index: openIndex ?? lastIndex, count: entries.length }}
              onStep={(d) => open(Math.min(entries.length - 1, Math.max(0, (openIndex ?? lastIndex) + d)))}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}


"use client";

import Link from "next/link";
import { ArrowRight, Braces, ChevronDown, ChevronUp, Database, ExternalLink, Fingerprint, Lock, Wrench } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AuditEventRow, AuditRunRow, UserAdminEventRow } from "@/app/(app)/audit/_lib/types";
import type { AuditTab } from "@/app/(app)/audit/_lib/filters";
import { AI_STATUS_LABELS, actionLabel } from "@/app/(app)/audit/_lib/labels";
import type { AppRole } from "@/lib/types";
import { orderHref } from "@/lib/routes";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActionIcon, Actor, EVENT_SOURCE, Pill, RUN_STATUS_TONE, seconds, show } from "./meta";
import { CopyButton, JsonBlock } from "./json-block";
import { formatField, humanizeKey } from "./summarize";

export type AuditEntry =
  | { tab: "events"; row: AuditEventRow }
  | { tab: "ai"; row: AuditRunRow }
  | { tab: "users"; row: UserAdminEventRow };

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fields({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y rounded-lg border">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
          <dt className="text-muted-foreground text-xs leading-5">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function When({ at }: { at: string }) {
  return (
    <span className="block">
      <span className="font-medium">{formatDateTime(at)}</span> <span className="text-muted-foreground text-xs">MYT</span>
      <span className="text-muted-foreground block font-mono text-[11px]">{at}</span>
    </span>
  );
}

function Integrity({ id, source }: { id: string; source: string }) {
  return (
    <div className="bg-primary/5 ring-primary/10 grid gap-2 rounded-lg p-3 text-xs ring-1 ring-inset">
      <div className="flex items-start gap-2">
        <Lock className="text-primary mt-px size-3.5 shrink-0" />
        <p>
          <span className="font-medium">Append-only record.</span>{" "}
          <span className="text-muted-foreground">It cannot be edited or deleted from the app.</span>
        </p>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Fingerprint className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground shrink-0">Entry ID</span>
        <code className="min-w-0 truncate font-mono">{id}</code>
        <CopyButton text={id} label="Copy entry ID" className="-my-1 ml-auto size-6" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Database className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground shrink-0">Written by</span>
        <code className="min-w-0 truncate font-mono">{source}</code>
      </div>
    </div>
  );
}

function PayloadFields({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload ?? {});
  if (!entries.length) return <p className="text-muted-foreground text-sm">No additional data was recorded with this event.</p>;
  return <Fields items={entries.map(([k, v]) => [humanizeKey(k), <span key={k}>{formatField(k, v)}</span>])} />;
}

function EventDetail({ row, viewerRole }: { row: AuditEventRow; viewerRole: AppRole }) {
  return (
    <>
      <Section title="Summary">
        <Fields
          items={[
            [
              "Order",
              <span key="o" className="flex flex-wrap items-center gap-x-2">
                <Link href={orderHref(viewerRole, row.order_id)} className="text-primary font-mono text-sm font-medium hover:underline">
                  {row.order_no ?? row.order_id.slice(0, 8)}
                </Link>
                {row.customer_name && <span className="text-muted-foreground text-xs">{row.customer_name}</span>}
              </span>,
            ],
            ["Actor", <Actor key="a" name={row.actor_name} role={row.actor_role} />],
            [
              "Transition",
              row.to_status ? (
                <span key="t" className="flex flex-wrap items-center gap-1.5">
                  {row.from_status ? <StatusBadge status={row.from_status} pulse={false} /> : <span className="text-muted-foreground text-xs">New</span>}
                  <ArrowRight className="text-muted-foreground size-3.5" aria-label="to" />
                  <StatusBadge status={row.to_status} pulse={false} />
                </span>
              ) : (
                <span key="t" className="text-muted-foreground text-sm">
                  No status change
                </span>
              ),
            ],
            ["Recorded", <When key="w" at={row.created_at} />],
          ]}
        />
      </Section>
      <Section title="Event data">
        <PayloadFields payload={row.payload} />
      </Section>
      <Section title="Raw payload" aside={<Braces className="text-muted-foreground size-3.5" />}>
        <JsonBlock value={row.payload} maxHeight="max-h-56" />
      </Section>
      <Integrity id={`order_events#${row.id}`} source={`public.${EVENT_SOURCE[row.action] ?? "workflow function"}`} />
    </>
  );
}

function RunDetail({ row }: { row: AuditRunRow }) {
  const tokens =
    row.input_tokens !== null || row.output_tokens !== null
      ? `${row.input_tokens !== null ? formatNumber(row.input_tokens) : "—"} in · ${row.output_tokens !== null ? formatNumber(row.output_tokens) : "—"} out`
      : "—";
  return (
    <>
      <Section title="Summary">
        <Fields
          items={[
            ["Outcome", <Pill key="s" tone={RUN_STATUS_TONE[row.status]}>{AI_STATUS_LABELS[row.status]}</Pill>],
            ["User", <Actor key="u" name={row.user_name} role={row.user_role} />],
            ["Model", <code key="m" className="font-mono text-xs">{row.model ?? "—"}</code>],
            ["Tokens", <span key="t" className="tabular">{tokens}</span>],
            ["Latency", <span key="l" className="tabular">{seconds(row.latency_ms)}</span>],
            ["Recorded", <When key="w" at={row.created_at} />],
          ]}
        />
      </Section>
      {row.error && (
        <Section title="Error">
          <p className="rounded-lg bg-red-500/5 px-3 py-2 text-sm break-words text-red-700 ring-1 ring-red-500/15 ring-inset dark:text-red-300">
            {row.error}
          </p>
        </Section>
      )}
      <Section title="Input" aside={row.input ? <CopyButton text={row.input} label="Copy input" className="size-6" /> : undefined}>
        <pre className="bg-muted/40 scrollbar-thin max-h-48 overflow-auto rounded-lg border p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
          {row.input ?? "—"}
        </pre>
      </Section>
      <Section title={`Tool-call trace · ${row.tool_calls.length}`} aside={<Wrench className="text-muted-foreground size-3.5" />}>
        {row.tool_calls.length ? (
          <ol className="relative space-y-2 border-l pl-4">
            {row.tool_calls.map((t, i) => (
              <li key={i} className="relative">
                <span
                  className={cn(
                    "ring-background absolute top-2.5 -left-[21px] size-2.5 rounded-full ring-4",
                    t.ok ? "bg-emerald-500" : "bg-red-500",
                  )}
                  aria-hidden
                />
                <div className="rounded-lg border p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground tabular">#{i + 1}</span>
                    <code className="font-mono font-semibold">{t.name}</code>
                    <Pill tone={t.ok ? "green" : "red"}>{t.ok ? "ok" : "failed"}</Pill>
                    {t.rows !== undefined && <span className="text-muted-foreground tabular">{t.rows} rows</span>}
                    {t.ms !== undefined && <span className="text-muted-foreground tabular">{t.ms} ms</span>}
                  </div>
                  <JsonBlock value={t.input} className="mt-2" maxHeight="max-h-40" />
                  {t.error && <p className="text-destructive mt-1.5 text-xs">{t.error}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-sm">No tools were called.</p>
        )}
      </Section>
      <Section title="Output" aside={row.output ? <CopyButton text={row.output} label="Copy output" className="size-6" /> : undefined}>
        <pre className="bg-muted/40 scrollbar-thin max-h-80 overflow-auto rounded-lg border p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
          {row.output ?? "—"}
        </pre>
      </Section>
      <Integrity id={`ai_runs#${row.id}`} source="AI gateway (server, service role)" />
    </>
  );
}

function UserDetail({ row }: { row: UserAdminEventRow }) {
  const changes = Object.entries(row.changes ?? {});
  return (
    <>
      <Section title="Summary">
        <Fields
          items={[
            [
              "Account",
              <span key="a" className="block">
                <span className="font-medium">{row.target_name}</span>
                {row.target_email && <span className="text-muted-foreground block text-xs break-all">{row.target_email}</span>}
              </span>,
            ],
            ["Changed by", <Actor key="b" name={row.actor_name} role={row.actor_role} />],
            ["Recorded", <When key="w" at={row.created_at} />],
          ]}
        />
      </Section>
      <Section title={`Field changes · ${changes.length}`}>
        {changes.length ? (
          <div className="divide-y rounded-lg border">
            {changes.map(([field, c]) => {
              const created = c.from === null || c.from === undefined;
              return (
                <div key={field} className="space-y-1.5 px-3 py-2.5">
                  <p className="text-muted-foreground text-xs font-medium">{humanizeKey(field)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {!created && (
                      <>
                        <span className="rounded-md bg-red-500/8 px-1.5 py-0.5 break-all text-red-700 line-through decoration-red-500/40 dark:text-red-300">
                          {show(c.from)}
                        </span>
                        <ArrowRight className="text-muted-foreground size-3.5 shrink-0" aria-label="changed to" />
                      </>
                    )}
                    <span className="rounded-md bg-emerald-500/8 px-1.5 py-0.5 font-medium break-all text-emerald-700 dark:text-emerald-300">
                      {show(c.to)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No field values changed (for example, a password reset).</p>
        )}
        <p className="text-muted-foreground text-[11px]">Passwords and secrets are never written to this log.</p>
      </Section>
      <Section title="Raw changes" aside={<Braces className="text-muted-foreground size-3.5" />}>
        <JsonBlock value={row.changes} maxHeight="max-h-48" />
      </Section>
      <Integrity id={`user_admin_events#${row.id}`} source="admin server action · append-only trigger" />
    </>
  );
}

export function entryTitle(entry: AuditEntry) {
  switch (entry.tab) {
    case "events":
      return actionLabel("events", entry.row.action);
    case "ai":
      return actionLabel("ai", entry.row.kind);
    case "users":
      return actionLabel("users", entry.row.action);
  }
}

function entryAction(entry: AuditEntry) {
  return entry.tab === "ai" ? entry.row.kind : entry.row.action;
}

export function AuditDetail({
  entry,
  viewerRole,
  position,
  onStep,
}: {
  entry: AuditEntry;
  viewerRole: AppRole;
  position: { index: number; count: number };
  onStep: (delta: -1 | 1) => void;
}) {
  const tab: AuditTab = entry.tab;
  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex items-start gap-3">
          <ActionIcon tab={tab} action={entryAction(entry)} className="size-10 rounded-xl" />
          <div className="min-w-0">
            <SheetTitle className="text-lg font-semibold">{entryTitle(entry)}</SheetTitle>
            <SheetDescription className="text-xs">
              {formatDateTime(entry.row.created_at)} MYT · <span suppressHydrationWarning>{formatRelative(entry.row.created_at)}</span>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4">
        {entry.tab === "events" && <EventDetail row={entry.row} viewerRole={viewerRole} />}
        {entry.tab === "ai" && <RunDetail row={entry.row} />}
        {entry.tab === "users" && <UserDetail row={entry.row} />}
      </div>

      <SheetFooter className="flex-row items-center gap-2 border-t">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-10 sm:size-9" disabled={position.index === 0} onClick={() => onStep(-1)} aria-label="Newer entry">
            <ChevronUp />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10 sm:size-9"
            disabled={position.index >= position.count - 1}
            onClick={() => onStep(1)}
            aria-label="Older entry"
          >
            <ChevronDown />
          </Button>
          <span className="text-muted-foreground ml-1 text-xs tabular">
            {position.index + 1} / {position.count}
          </span>
        </div>
        {entry.tab === "events" && (
          <Link
            href={orderHref(viewerRole, entry.row.order_id)}
            className={cn(buttonVariants({ variant: "default" }), "ml-auto h-10 sm:h-9")}
          >
            Open order <ExternalLink />
          </Link>
        )}
      </SheetFooter>
    </>
  );
}

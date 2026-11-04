"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Lock, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, formatMYR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DecisionRow, HistoryFilters } from "@/app/(app)/manager/reviews/_lib/workspace";
import { Stars } from "./review-tabs";

const KIND = {
  approved: { label: "Approved", icon: CheckCircle2, cls: "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300" },
  rework: { label: "Sent back", icon: RotateCcw, cls: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-300" },
  closed: { label: "Closed", icon: Lock, cls: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" },
} as const;

function hrefFor(f: HistoryFilters, patch: Partial<HistoryFilters>) {
  const next = { ...f, page: 1, ...patch };
  const p = new URLSearchParams({ tab: "history" });
  if (next.q) p.set("q", next.q);
  if (next.decision !== "all") p.set("decision", next.decision);
  if (next.who !== "all") p.set("who", next.who);
  if (next.range !== "30d") p.set("range", next.range);
  if (next.page > 1) p.set("page", String(next.page));
  return `/manager/reviews?${p.toString()}`;
}

/** Every approval, rework and close, from the tamper-evident audit trail. */
export function DecisionHistory({
  filters,
  rows,
  total,
  pages,
  counts,
}: {
  filters: HistoryFilters;
  rows: DecisionRow[];
  total: number;
  pages: number;
  counts: { approved: number; rework: number; closed: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);
  const go = (patch: Partial<HistoryFilters>) => start(() => router.push(hrefFor(filters, patch), { scroll: false }));
  const exportHref = `/manager/reviews/export?${new URL(hrefFor(filters, {}), "http://x").searchParams.toString()}`;
  const ratings = rows.filter((r) => r.rating).map((r) => r.rating!);

  return (
    <div className="space-y-3">
      <div className="bg-card grid gap-2 rounded-xl border p-2.5 shadow-xs sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)_auto] sm:items-center">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() });
          }}
          className="relative"
        >
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => q.trim() !== filters.q && go({ q: q.trim() })}
            placeholder="Order no., customer, phone…"
            aria-label="Search decisions"
            className="bg-background h-11 w-full rounded-lg border pr-2 pl-8 text-base outline-none focus-visible:ring-2 sm:h-9 sm:text-sm"
          />
        </form>
        <NativeSelect aria-label="Decision" value={filters.decision} onChange={(e) => go({ decision: e.target.value as HistoryFilters["decision"] })}>
          <option value="all">All decisions</option>
          <option value="approved">Approved</option>
          <option value="rework">Sent back</option>
          <option value="closed">Closed</option>
        </NativeSelect>
        <NativeSelect aria-label="Decided by" value={filters.who} onChange={(e) => go({ who: e.target.value as HistoryFilters["who"] })}>
          <option value="all">Everyone</option>
          <option value="me">Only mine</option>
        </NativeSelect>
        <NativeSelect aria-label="Period" value={filters.range} onChange={(e) => go({ range: e.target.value as HistoryFilters["range"] })}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </NativeSelect>
        <a href={exportHref} className={cn(buttonVariants({ variant: "outline" }), "h-11 sm:h-9")} download>
          <Download /> CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["approved", "rework", "closed"] as const).map((k) => {
          const { label, icon: Icon, cls } = KIND[k];
          const on = filters.decision === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => go({ decision: on ? "all" : k })}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium ring-1 ring-inset transition-opacity", cls, filters.decision !== "all" && !on && "opacity-50")}
              aria-pressed={on}
            >
              <Icon className="size-3.5" /> {label} <span className="tabular-nums">{counts[k]}</span>
            </button>
          );
        })}
        {ratings.length > 0 && (
          <span className="text-muted-foreground inline-flex h-8 items-center gap-1.5 px-1">
            Avg rating on this page <Stars value={Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length)} />
          </span>
        )}
      </div>

      <div className={cn("transition-opacity", pending && "pointer-events-none opacity-55")} aria-busy={pending}>
        {rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} className="bg-card py-14" title="No decisions match" description="Try a longer period or clear the filters." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Technician</th>
                    <th className="px-3 py-2 text-right font-medium">Final</th>
                    <th className="px-3 py-2 font-medium">Rating / note</th>
                    <th className="px-3 py-2 font-medium">By</th>
                    <th className="px-3 py-2 font-medium">Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const { label, icon: Icon, cls } = KIND[r.kind];
                    return (
                      <tr key={r.id} className="hover:bg-muted/40 align-top">
                        <td className="text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap tabular-nums">{formatDateTime(r.at)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", cls)}>
                            <Icon className="size-3" /> {label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/manager/orders/${r.orderId}`} className="text-primary font-mono text-[13px] font-semibold hover:underline">
                            {r.orderNo}
                          </Link>
                          <span className="text-muted-foreground block max-w-40 truncate text-xs">{r.customer}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{r.technician}</td>
                        <td className="px-3 py-2.5 text-right text-xs tabular-nums">{r.final !== null ? formatMYR(r.final) : "—"}</td>
                        <td className="max-w-64 px-3 py-2.5">
                          {r.kind === "approved" && <Stars value={r.rating} />}
                          {r.notes && <p className="text-muted-foreground line-clamp-2 text-xs">“{r.notes}”</p>}
                          {!r.notes && r.kind !== "approved" && <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.by}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="space-y-2 md:hidden">
              {rows.map((r) => {
                const { label, icon: Icon, cls } = KIND[r.kind];
                return (
                  <li key={r.id} className="bg-card rounded-xl border p-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", cls)}>
                        <Icon className="size-3" /> {label}
                      </span>
                      <Link href={`/manager/orders/${r.orderId}`} className="text-primary font-mono text-[13px] font-semibold">
                        {r.orderNo}
                      </Link>
                      <span className="ml-auto">
                        <StatusBadge status={r.status} />
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium">{r.customer}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.technician}
                      {r.final !== null && ` · ${formatMYR(r.final)}`} · {formatDateTime(r.at)} · {r.by}
                    </p>
                    {r.kind === "approved" && <Stars value={r.rating} className="mt-1.5" />}
                    {r.notes && <p className="text-muted-foreground mt-1 text-xs">“{r.notes}”</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {total.toLocaleString("en-MY")} decision{total === 1 ? "" : "s"} · from the tamper-evident audit trail
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={filters.page <= 1 || pending}
              onClick={() => go({ page: filters.page - 1 })}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 sm:h-8")}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </button>
            <span className="tabular-nums">
              Page {filters.page} of {pages}
            </span>
            <button
              type="button"
              disabled={filters.page >= pages || pending}
              onClick={() => go({ page: filters.page + 1 })}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 sm:h-8")}
              aria-label="Next page"
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

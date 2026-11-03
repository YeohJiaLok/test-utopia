"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarRange, Download, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NativeSelect } from "@/components/shared/form-field";
import {
  ACTIONS,
  AI_STATUSES,
  AUDIT_TABS,
  DEFAULT_RANGE,
  PAGE_SIZES,
  RANGE_OPTIONS,
  ROLES,
  auditExportHref,
  auditHref,
  type AiStatus,
  type AuditFilters,
  type AuditRole,
} from "@/app/(app)/audit/_lib/filters";
import { AI_STATUS_LABELS, ROLE_LABELS, TAB_LABELS, actionLabel } from "@/app/(app)/audit/_lib/labels";
import { cn } from "@/lib/utils";
import { useAuditNav } from "./audit-nav";
import { TAB_ICONS } from "./meta";

/** A real link (shareable, middle-clickable) that navigates inside the shared transition. */
function NavLink({ href, className, children, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const { go } = useAuditNav();
  return (
    <Link
      href={href}
      scroll={false}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        go(href);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

const SEARCH_HINT = {
  events: "Search order no, customer, actor or action…",
  ai: "Search question, output, model or user…",
  users: "Search user, email or admin…",
} as const;

function Filters({ filters, idPrefix, stacked }: { filters: AuditFilters; idPrefix: string; stacked?: boolean }) {
  const { go } = useAuditNav();
  const field = stacked ? "space-y-1.5" : "w-full lg:w-44";
  const label = stacked ? "text-xs font-medium" : "sr-only";
  return (
    <>
      <div className={field}>
        <label htmlFor={`${idPrefix}-action`} className={label}>
          {filters.tab === "ai" ? "Run kind" : "Action"}
        </label>
        <NativeSelect
          id={`${idPrefix}-action`}
          value={filters.action}
          onChange={(e) => go(auditHref(filters, { action: e.target.value }))}
          className={cn(stacked && "h-11")}
        >
          <option value="">{filters.tab === "ai" ? "All kinds" : "All actions"}</option>
          {ACTIONS[filters.tab].map((a) => (
            <option key={a} value={a}>
              {actionLabel(filters.tab, a)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {filters.tab !== "users" && (
        <div className={field}>
          <label htmlFor={`${idPrefix}-role`} className={label}>
            {filters.tab === "ai" ? "User role" : "Actor role"}
          </label>
          <NativeSelect
            id={`${idPrefix}-role`}
            value={filters.role}
            onChange={(e) => go(auditHref(filters, { role: e.target.value as AuditRole | "" }))}
            className={cn(stacked && "h-11")}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {filters.tab === "ai" && (
        <div className={field}>
          <label htmlFor={`${idPrefix}-status`} className={label}>
            Outcome
          </label>
          <NativeSelect
            id={`${idPrefix}-status`}
            value={filters.status}
            onChange={(e) => go(auditHref(filters, { status: e.target.value as AiStatus | "" }))}
            className={cn(stacked && "h-11")}
          >
            <option value="">All outcomes</option>
            {AI_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AI_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </>
  );
}

function CustomRange({ filters }: { filters: AuditFilters }) {
  const { go } = useAuditNav();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const fromId = useId();
  const toId = useId();
  const active = filters.range === "custom";

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setFrom(filters.from);
          setTo(filters.to);
        }
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          />
        }
      >
        {active && (
          <motion.span
            layoutId="audit-range"
            className="bg-primary/8 ring-primary/15 absolute inset-0 rounded-lg ring-1 ring-inset"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        <CalendarRange className="relative size-3.5" />
        <span className="relative">{active ? "Custom" : <><span className="sm:hidden">Range</span><span className="hidden sm:inline">Custom</span></>}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(18rem,calc(100vw-2rem))] gap-3 p-3">
        <p className="text-sm font-medium">Custom range</p>
        <p className="text-muted-foreground -mt-2 text-xs">Whole days in Malaysia time (MYT), inclusive.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor={fromId} className="text-xs font-medium">
              From
            </label>
            <input
              id={fromId}
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={toId} className="text-xs font-medium">
              To
            </label>
            <input
              id={toId}
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>
        </div>
        <Button
          disabled={!from && !to}
          onClick={() => {
            setOpen(false);
            go(auditHref(filters, { range: "custom", from, to }));
          }}
        >
          Apply range
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function AuditToolbar({ filters, rangeLabel }: { filters: AuditFilters; rangeLabel: string }) {
  const { go, pending } = useAuditNav();
  const searchId = useId();
  const sizeId = useId();
  const [sheetOpen, setSheetOpen] = useState(false);

  const [query, setQuery] = useState(filters.q);
  const [pushedQ, setPushedQ] = useState(filters.q);
  const [prevQ, setPrevQ] = useState(filters.q);
  // Keep the input in sync when the URL changes elsewhere (chips, clear all, back button).
  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    if (filters.q !== pushedQ) setQuery(filters.q);
  }

  useEffect(() => {
    const term = query.trim();
    if (term === filters.q) return;
    const t = setTimeout(() => {
      setPushedQ(term);
      go(auditHref(filters, { q: term }));
    }, 350);
    return () => clearTimeout(t);
  }, [query, filters, go]);

  const panelFilters = [filters.action, filters.role, filters.status].filter(Boolean).length;

  const chips: { key: string; label: string; clear: Partial<AuditFilters> }[] = [];
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, clear: { q: "" } });
  if (filters.action)
    chips.push({
      key: "action",
      label: `${filters.tab === "ai" ? "Kind" : "Action"}: ${actionLabel(filters.tab, filters.action)}`,
      clear: { action: "" },
    });
  if (filters.role) chips.push({ key: "role", label: `Role: ${ROLE_LABELS[filters.role]}`, clear: { role: "" } });
  if (filters.status) chips.push({ key: "status", label: `Outcome: ${AI_STATUS_LABELS[filters.status]}`, clear: { status: "" } });
  if (filters.range !== DEFAULT_RANGE) chips.push({ key: "range", label: rangeLabel, clear: { range: DEFAULT_RANGE } });

  return (
    <div className="space-y-3">
      {/* Tabs: a contained horizontal scroller so they never widen the page. */}
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-0.5">
        <nav className="bg-muted inline-flex min-w-full rounded-xl p-1 sm:min-w-0" aria-label="Audit log">
          {AUDIT_TABS.map((t) => {
            const Icon = TAB_ICONS[t];
            const active = filters.tab === t;
            return (
              <NavLink
                key={t}
                href={auditHref(filters, { tab: t })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none sm:px-4",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="audit-tab"
                    className="bg-background absolute inset-0 rounded-lg shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className={cn("relative size-4", active && "text-primary")} />
                <span className="relative sm:hidden">{TAB_LABELS[t].short}</span>
                <span className="relative hidden sm:inline">{TAB_LABELS[t].label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <label htmlFor={searchId} className="sr-only">
            Search the audit log
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SEARCH_HINT[filters.tab]}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-10 w-full rounded-lg border pr-9 pl-9 text-sm outline-none focus-visible:ring-3 lg:h-9"
          />
          {pending ? (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" aria-label="Loading" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )
          )}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Filters filters={filters} idPrefix="audit-desktop" />
        </div>

        <Button
          variant="outline"
          className="relative h-10 shrink-0 px-3 lg:hidden"
          onClick={() => setSheetOpen(true)}
          aria-label={`Filters${panelFilters ? ` (${panelFilters} active)` : ""}`}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filters</span>
          {panelFilters > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold tabular">
              {panelFilters}
            </span>
          )}
        </Button>

        <a
          href={auditExportHref(filters)}
          download
          className={cn(buttonVariants({ variant: "outline" }), "h-10 shrink-0 px-3 lg:ml-auto lg:h-9")}
          aria-label="Export the filtered view as CSV"
          title="Export CSV (current filters, up to 5,000 rows)"
        >
          <Download />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </div>

      <div className="flex items-center gap-2">
        <div className="scrollbar-thin -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((r) => {
            const active = filters.range === r.key;
            return (
              <NavLink
                key={r.key}
                href={auditHref(filters, { range: r.key })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="audit-range"
                    className="bg-primary/8 ring-primary/15 absolute inset-0 rounded-lg ring-1 ring-inset"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative sm:hidden">{r.short}</span>
                <span className="relative hidden sm:inline">{r.label}</span>
              </NavLink>
            );
          })}
          <CustomRange key={`${filters.from}-${filters.to}`} filters={filters} />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((c) => (
            <NavLink
              key={c.key}
              href={auditHref(filters, c.clear)}
              className="bg-primary/6 text-primary ring-primary/15 hover:bg-primary/10 inline-flex h-7 max-w-full items-center gap-1 rounded-full pr-1.5 pl-2.5 text-xs font-medium ring-1 ring-inset transition-colors"
              aria-label={`Remove filter ${c.label}`}
            >
              <span className="truncate">{c.label}</span>
              <X className="size-3.5 shrink-0" />
            </NavLink>
          ))}
          <NavLink
            href={auditHref(filters, { q: "", action: "", role: "", status: "", range: DEFAULT_RANGE })}
            className="text-muted-foreground hover:text-foreground px-2 text-xs font-medium underline-offset-4 hover:underline"
          >
            Clear all
          </NavLink>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Filter {TAB_LABELS[filters.tab].label.toLowerCase()}</SheetTitle>
            <SheetDescription>Changes apply instantly and are kept in the page link.</SheetDescription>
          </SheetHeader>
          <div className="scrollbar-thin space-y-4 overflow-y-auto p-4">
            <Filters filters={filters} idPrefix="audit-sheet" stacked />
            <div className="space-y-1.5">
              <label htmlFor={sizeId} className="text-xs font-medium">
                Rows per page
              </label>
              <NativeSelect
                id={sizeId}
                value={String(filters.size)}
                onChange={(e) => go(auditHref(filters, { size: Number(e.target.value) }))}
                className="h-11"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} per page
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <SheetFooter className="grid grid-cols-2 border-t">
            <Button
              variant="outline"
              className="h-11"
              disabled={!panelFilters}
              onClick={() => go(auditHref(filters, { action: "", role: "", status: "" }))}
            >
              Reset
            </Button>
            <Button className="h-11" onClick={() => setSheetOpen(false)}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

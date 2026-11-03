"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Columns3, List, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/form-field";
import { ORDER_STATUSES, STATUS_META } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ordersHref, type OrderFilters } from "./orders-url";

interface Option {
  id: string;
  label: string;
}

/** Status tabs, search, technician / branch filters and list ↔ board toggle, all URL-driven. */
export function OrdersToolbar({
  filters,
  counts,
  technicians,
  branches,
}: {
  filters: OrderFilters;
  counts: Record<OrderStatus | "all", number>;
  technicians: Option[];
  branches: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const techId = useId();
  const branchId = useId();

  const [query, setQuery] = useState(filters.q);
  const [pushedQ, setPushedQ] = useState(filters.q);
  const [prevQ, setPrevQ] = useState(filters.q);
  // Keep the input in sync when the URL changes from elsewhere (tabs, "clear filters", back button).
  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    if (filters.q !== pushedQ) setQuery(filters.q);
  }

  function navigate(patch: Partial<OrderFilters>) {
    startTransition(() => router.push(ordersHref(filters, patch), { scroll: false }));
  }

  useEffect(() => {
    const term = query.trim();
    if (term === filters.q) return;
    const t = setTimeout(() => {
      setPushedQ(term);
      startTransition(() => router.push(ordersHref(filters, { q: term }), { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [query, filters, router]);

  const hasFilters = !!(filters.q || filters.tech || filters.branch);
  const tabs: (OrderStatus | "all")[] = ["all", ...ORDER_STATUSES];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search orders
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order no, customer or phone…"
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 w-full rounded-lg border pr-9 pl-9 text-sm outline-none focus-visible:ring-3"
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <label htmlFor={techId} className="sr-only">
            Technician
          </label>
          <NativeSelect id={techId} value={filters.tech} onChange={(e) => navigate({ tech: e.target.value })} className="sm:w-48">
            <option value="">All technicians</option>
            <option value="none">Unassigned</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
          <label htmlFor={branchId} className="sr-only">
            Branch
          </label>
          <NativeSelect id={branchId} value={filters.branch} onChange={(e) => navigate({ branch: e.target.value })} className="sm:w-44">
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
          <div className="bg-muted col-span-2 inline-flex h-9 rounded-lg p-0.5 sm:col-span-1" role="group" aria-label="View">
            {(
              [
                { key: "list", label: "List", icon: List },
                { key: "board", label: "Board", icon: Columns3 },
              ] as const
            ).map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={filters.view === v.key}
                onClick={() => navigate({ view: v.key })}
                className={cn(
                  "relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                  filters.view === v.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filters.view === v.key && (
                  <motion.span layoutId="orders-view-toggle" className="bg-background absolute inset-0 rounded-md shadow-sm" />
                )}
                <v.icon className="relative size-4" />
                <span className="relative">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {filters.view === "list" ? (
          <nav className="scrollbar-thin -mx-1 flex flex-1 gap-1 overflow-x-auto px-1 pb-1" aria-label="Filter by status">
            {tabs.map((s) => {
              const active = filters.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => navigate({ status: s })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="orders-status-tab"
                      className="bg-primary/8 ring-primary/15 absolute inset-0 rounded-lg ring-1 ring-inset"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{s === "all" ? "All" : STATUS_META[s].label}</span>
                  <span
                    className={cn(
                      "relative rounded-full px-1.5 text-[11px] font-semibold tabular",
                      active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[s].toLocaleString("en-MY")}
                  </span>
                </button>
              );
            })}
          </nav>
        ) : (
          <p className="text-muted-foreground flex-1 text-sm">
            <span className="text-foreground font-medium tabular">{counts.all.toLocaleString("en-MY")}</span> orders · latest per stage
          </p>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setQuery("");
              navigate({ q: "", tech: "", branch: "" });
            }}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

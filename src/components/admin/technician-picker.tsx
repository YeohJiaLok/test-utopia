"use client";

import { useId, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, ChevronsUpDown, Search, Sparkles, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EASE } from "@/components/motion";
import { initials } from "@/lib/format";
import type { TechnicianWithLoad } from "@/lib/data/reference";
import { cn } from "@/lib/utils";
import { LOAD_META, LoadMeter, loadLevel } from "./load-meter";

/**
 * Least-loaded active technician, preferring the order's branch when known.
 * Ties break on name so the recommendation is stable between renders.
 */
export function recommendTechnician(technicians: TechnicianWithLoad[], branchId?: number | null) {
  const pool = branchId ? technicians.filter((t) => t.branch_id === branchId) : technicians;
  const candidates = pool.length ? pool : technicians;
  return [...candidates].sort((a, b) => a.open_jobs - b.open_jobs || a.name.localeCompare(b.name))[0] ?? null;
}

function TechAvatar({ tech, className }: { tech: TechnicianWithLoad; className?: string }) {
  const level = loadLevel(tech.open_jobs);
  return (
    <span className={cn("bg-primary/10 text-primary relative flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", className)}>
      {initials(tech.name)}
      <span className={cn("ring-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2", LOAD_META[level].dot)} aria-hidden />
    </span>
  );
}

/** Inline, searchable list of technicians with branch + live open-job load. */
export function TechnicianList({
  technicians,
  value,
  onSelect,
  recommendedId,
  allowUnassigned,
  className,
  autoFocus,
}: {
  technicians: TechnicianWithLoad[];
  value: string | null;
  onSelect: (id: string | null) => void;
  recommendedId?: string | null;
  allowUnassigned?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? technicians.filter((t) =>
          [t.name, t.team_code, t.branch_name, ...t.skills].some((s) => s.toLowerCase().includes(q)),
        )
      : technicians;
    return [...filtered].sort((a, b) => {
      if (a.id === recommendedId) return -1;
      if (b.id === recommendedId) return 1;
      return a.open_jobs - b.open_jobs || a.name.localeCompare(b.name);
    });
  }, [technicians, query, recommendedId]);

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={searchId} className="sr-only">
        Search technicians
      </label>
      <div className="relative border-b p-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
        <input
          id={searchId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, team, branch or skill…"
          autoFocus={autoFocus}
          className="placeholder:text-muted-foreground h-8 w-full rounded-md bg-transparent pr-2 pl-8 text-sm outline-none"
        />
      </div>
      <div className="scrollbar-thin max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Technicians">
        {allowUnassigned && !query && (
          <button
            type="button"
            role="option"
            aria-selected={value === null}
            onClick={() => onSelect(null)}
            className={cn(
              "hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
              value === null && "bg-muted",
            )}
          >
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
              <UserX className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Leave unassigned</span>
              <span className="text-muted-foreground block text-xs">Order stays in the dispatch queue</span>
            </span>
            {value === null && <Check className="text-primary size-4" />}
          </button>
        )}
        {items.map((t, i) => {
          const selected = value === t.id;
          const level = loadLevel(t.open_jobs);
          return (
            <motion.button
              key={t.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(t.id)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 10) * 0.02 }}
              className={cn(
                "hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                selected && "bg-primary/8 hover:bg-primary/10",
              )}
            >
              <TechAvatar tech={t} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  {t.id === recommendedId && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="size-2.5" /> Recommended
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {t.team_code} · {t.branch_name}
                </span>
              </span>
              <span className="flex w-20 shrink-0 flex-col items-end gap-1">
                <span className={cn("text-[11px] font-medium tabular", LOAD_META[level].text)}>
                  {t.open_jobs} open
                </span>
                <LoadMeter openJobs={t.open_jobs} className="w-full" />
              </span>
              <Check className={cn("text-primary size-4 shrink-0", !selected && "invisible")} />
            </motion.button>
          );
        })}
        {!items.length && (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">No technician matches “{query}”.</p>
        )}
      </div>
    </div>
  );
}

/** Popover picker used by the order form and the dispatch queue. */
export function TechnicianPicker({
  technicians,
  value,
  onChange,
  preferBranchId,
  allowUnassigned,
  id,
  invalid,
  disabled,
  className,
  size = "default",
}: {
  technicians: TechnicianWithLoad[];
  value: string | null;
  onChange: (id: string | null) => void;
  preferBranchId?: number | null;
  allowUnassigned?: boolean;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const recommended = useMemo(() => recommendTechnician(technicians, preferBranchId), [technicians, preferBranchId]);
  const selected = technicians.find((t) => t.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between gap-2 px-2.5 font-normal",
              size === "default" ? "h-auto min-h-9 py-1.5" : "h-8",
              className,
            )}
          />
        }
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            {size === "default" && <TechAvatar tech={selected} className="size-6 text-[10px]" />}
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{selected.name}</span>
              {size === "default" && (
                <span className="text-muted-foreground block truncate text-xs">
                  {selected.branch_name} · {selected.open_jobs} open job{selected.open_jobs === 1 ? "" : "s"}
                </span>
              )}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground truncate text-sm">
            {allowUnassigned ? "Unassigned — pick a technician" : "Choose technician"}
          </span>
        )}
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(var(--anchor-width),calc(100vw-2rem))] min-w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
        <TechnicianList
          technicians={technicians}
          value={value}
          recommendedId={recommended?.id}
          allowUnassigned={allowUnassigned}
          autoFocus
          onSelect={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

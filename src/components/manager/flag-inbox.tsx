"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { rescanFlags } from "@/lib/ai/actions";
import { EASE } from "@/components/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-field";
import { StatusBadge, TONE_CLASSES } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { FlagWithOrder } from "@/app/(app)/manager/_lib/queries";
import type { FlagSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FlagCard } from "./flag-card";
import { ResolveFlagDialog } from "./resolve-flag-dialog";

const SEVERITIES: FlagSeverity[] = ["high", "medium", "low"];
const SEVERITY_LABEL: Record<FlagSeverity, string> = { high: "High severity", medium: "Medium severity", low: "Low severity" };
const SEVERITY_TONE = { high: "red", medium: "amber", low: "slate" } as const;

type SourceFilter = "all" | "rule" | "ai";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 relative h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 sm:h-7 sm:px-3",
        active
          ? "bg-foreground text-background border-transparent shadow-xs"
          : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function RescanButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="max-sm:h-11 max-sm:w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const res = await rescanFlags();
            toast.success("AI Supervisor re-scan complete", {
              description: `${res.scanned} order${res.scanned === 1 ? "" : "s"} scanned · ${res.flagged} flag${res.flagged === 1 ? "" : "s"} raised`,
            });
            router.refresh();
          } catch {
            toast.error("Re-scan failed", { description: "The AI Supervisor could not complete the scan. Try again shortly." });
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Scanning…" : "Re-scan with AI"}
    </Button>
  );
}

export function FlagInbox({ flags, showResolved }: { flags: FlagWithOrder[]; showResolved: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [toggling, startToggle] = useTransition();
  const [severity, setSeverity] = useState<FlagSeverity | "all">("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [tech, setTech] = useState("all");

  const technicians = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of flags) if (f.order?.technician) m.set(f.order.technician.id, f.order.technician.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [flags]);

  const counts = useMemo(
    () => Object.fromEntries(SEVERITIES.map((s) => [s, flags.filter((f) => f.severity === s).length])) as Record<FlagSeverity, number>,
    [flags],
  );

  const visible = flags.filter(
    (f) =>
      (severity === "all" || f.severity === severity) &&
      (source === "all" || f.source === source) &&
      (tech === "all" || f.order?.technician?.id === tech),
  );
  const groups = SEVERITIES.map((s) => ({ severity: s, items: visible.filter((f) => f.severity === s) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {SEVERITIES.map((s) => {
          const active = severity === s;
          const share = flags.length ? counts[s] / flags.length : 0;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setSeverity(active ? "all" : s)}
              className={cn(
                "bg-card focus-visible:ring-ring/50 relative overflow-hidden rounded-xl border p-3 text-left shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-3 sm:p-4",
                active && "ring-primary/50 border-primary/40 ring-2",
              )}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                <span className={cn("size-2 rounded-full", TONE_CLASSES[SEVERITY_TONE[s]].dot)} />
                <span className="text-muted-foreground capitalize">{s}</span>
              </span>
              <span className="tabular mt-1 block text-2xl font-semibold tracking-tight">{counts[s]}</span>
              <span className="bg-muted mt-2 block h-1 overflow-hidden rounded-full" aria-hidden>
                <motion.span
                  className={cn("block h-full rounded-full", TONE_CLASSES[SEVERITY_TONE[s]].dot)}
                  initial={{ width: 0 }}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ duration: 0.7, ease: EASE }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={severity === "all"} onClick={() => setSeverity("all")}>
            All severities
          </Chip>
          {SEVERITIES.map((s) => (
            <Chip key={s} active={severity === s} onClick={() => setSeverity(s)}>
              <span className="capitalize">{s}</span>
            </Chip>
          ))}
          <span className="basis-full sm:hidden" aria-hidden />
          <span className="bg-border mx-1 hidden h-5 w-px sm:block" aria-hidden />
          <Chip active={source === "all"} onClick={() => setSource("all")}>
            Any source
          </Chip>
          <Chip active={source === "rule"} onClick={() => setSource("rule")}>
            Rules
          </Chip>
          <Chip active={source === "ai"} onClick={() => setSource("ai")}>
            AI reviewer
          </Chip>
        </div>
        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center lg:border-t-0 lg:pt-0">
          <div className="min-w-0 sm:w-52">
            <NativeSelect
              aria-label="Filter by technician"
              value={tech}
              onChange={(e) => setTech(e.target.value)}
              className="max-sm:h-11"
            >
              <option value="all">All technicians</option>
              {technicians.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium sm:min-h-0">
            <Switch
              checked={showResolved}
              disabled={toggling}
              onCheckedChange={(v) =>
                startToggle(() => router.push(v ? `${pathname}?resolved=1` : pathname, { scroll: false }))
              }
            />
            Show resolved
            {toggling && <Loader2 className="size-3.5 animate-spin" />}
          </label>
        </div>
      </div>

      <p className="text-muted-foreground px-1 text-xs" aria-live="polite">
        {visible.length} {showResolved ? "resolved" : "open"} flag{visible.length === 1 ? "" : "s"}
        {visible.length !== flags.length ? ` (filtered from ${flags.length})` : ""}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          className="bg-card py-16"
          title={flags.length ? "No flags match these filters" : showResolved ? "No resolved flags yet" : "Inbox zero"}
          description={
            flags.length
              ? "Clear a filter to see more findings."
              : showResolved
                ? "Resolved findings and their notes will be listed here."
                : "The AI Supervisor has no open findings. Re-scan to check recent completions again."
          }
        />
      ) : (
        <div className={cn("space-y-6 transition-opacity", toggling && "opacity-60")}>
          {groups.map((g) => (
            <section key={g.severity} aria-labelledby={`group-${g.severity}`} className="space-y-3">
              <h2 id={`group-${g.severity}`} className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                <span className={cn("size-2 rounded-full", TONE_CLASSES[SEVERITY_TONE[g.severity]].dot)} />
                {SEVERITY_LABEL[g.severity]}
                <span className="bg-muted text-muted-foreground tabular rounded-full px-1.5 py-px text-[10px] font-semibold">{g.items.length}</span>
                <span aria-hidden className="bg-border ml-1 h-px flex-1" />
              </h2>
              <motion.ul layout className="grid gap-3 xl:grid-cols-2">
                <AnimatePresence mode="popLayout" initial>
                  {g.items.map((f, i) => (
                    <motion.li
                      key={f.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 10) * 0.03 }}
                    >
                      <FlagCard
                        flag={f}
                        className="h-full"
                        resolverName={f.resolver?.full_name}
                        header={
                          f.order ? (
                            <Link
                              href={`/manager/orders/${f.order.id}`}
                              className="hover:text-primary inline-flex min-w-0 items-center gap-1 text-xs font-medium"
                            >
                              <span className="font-mono">{f.order.order_no}</span>
                              <ArrowUpRight className="size-3" />
                            </Link>
                          ) : null
                        }
                        action={
                          <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t pt-3">
                            <span className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
                              {f.order && <StatusBadge status={f.order.status} className="h-5 px-2 text-[11px]" pulse={false} />}
                              <span className="truncate">
                                {f.order?.customer_name}
                                {f.order?.technician ? ` · ${f.order.technician.name}` : ""}
                              </span>
                            </span>
                            <ResolveFlagDialog flagId={f.id} title={f.title} className="max-sm:h-10 max-sm:px-3.5" />
                          </div>
                        }
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

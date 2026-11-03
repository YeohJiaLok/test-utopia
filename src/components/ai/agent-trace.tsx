"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  FileText,
  Gauge,
  Hash,
  Loader2,
  PenLine,
  Search,
  ShieldAlert,
  Trophy,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { EASE } from "@/components/motion";
import { TOOL_LABELS } from "@/lib/ai/catalogue";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssistantTurn, TraceStep } from "./use-copilot";

const TOOL_ICONS: Record<string, LucideIcon> = {
  get_time_context: CalendarClock,
  list_technicians: Users,
  search_jobs: Search,
  count_jobs: Hash,
  technician_performance: Trophy,
  get_order_details: FileText,
  workload_analysis: Gauge,
  list_flags: ShieldAlert,
};

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}(T|$)/;

function chipValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.map((v) => String(v).replace(/_/g, " ")).join(", ") : null;
  if (typeof value === "string") return ISO_LIKE.test(value) ? formatDate(value) : value.replace(/_/g, " ");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Compact "key: value" chips for a tool input. */
export function inputChips(input: unknown, max = 5): { key: string; value: string }[] {
  if (!input || typeof input !== "object") return [];
  const chips: { key: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const value = chipValue(raw);
    if (value) chips.push({ key: key.replace(/_/g, " "), value: value.length > 28 ? `${value.slice(0, 27)}…` : value });
    if (chips.length >= max) break;
  }
  return chips;
}

type StepState = "running" | "ok" | "error" | "idle";

function StatusIcon({ state }: { state: StepState }) {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {state === "running" ? (
          <motion.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }}>
            <Loader2 className="text-primary size-3.5 animate-spin" />
          </motion.span>
        ) : state === "ok" ? (
          <motion.span
            key="ok"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
            className="bg-success/15 text-success flex size-4 items-center justify-center rounded-full"
          >
            <Check className="size-2.5" strokeWidth={3} />
          </motion.span>
        ) : state === "error" ? (
          <motion.span
            key="err"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-destructive/15 text-destructive flex size-4 items-center justify-center rounded-full"
          >
            <X className="size-2.5" strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span key="idle" className="bg-muted-foreground/30 size-1.5 rounded-full" />
        )}
      </AnimatePresence>
    </span>
  );
}

function StepRow({
  icon: Icon,
  title,
  state,
  meta,
  children,
  last,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  state: StepState;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="relative flex gap-2.5 pb-3 last:pb-0"
    >
      {!last && <span aria-hidden className="bg-border absolute top-6 bottom-0 left-[11px] w-px" />}
      <span
        className={cn(
          "bg-background relative z-10 mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md border",
          state === "running" && "border-primary/40 text-primary shadow-[0_0_0_3px] shadow-primary/10",
          state === "ok" && "text-foreground/70",
          state === "error" && "border-destructive/40 text-destructive",
        )}
      >
        <Icon className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 text-xs leading-5 font-medium">{title}</div>
          {meta && <div className="text-muted-foreground tabular shrink-0 text-[11px] leading-5">{meta}</div>}
          <StatusIcon state={state} />
        </div>
        {children}
      </div>
    </motion.li>
  );
}

function ToolStep({ step, last }: { step: Extract<TraceStep, { kind: "tool" }>; last: boolean }) {
  const chips = inputChips(step.input);
  return (
    <StepRow
      icon={TOOL_ICONS[step.name] ?? Workflow}
      title={
        <span className="flex items-center gap-1.5">
          {TOOL_LABELS[step.name] ?? step.name}
          <code className="text-muted-foreground/80 hidden font-mono text-[10px] font-normal sm:inline">{step.name}</code>
        </span>
      }
      state={step.status}
      meta={step.status !== "running" && step.ms !== undefined ? `${step.rows ?? 0} rows · ${step.ms}ms` : undefined}
      last={last}
    >
      {chips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((c) => (
            <span key={c.key} className="bg-muted text-muted-foreground inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px]">
              <span className="opacity-70">{c.key}</span>
              <span className="text-foreground/80 truncate font-medium">{c.value}</span>
            </span>
          ))}
        </div>
      )}
      {step.summary && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn("mt-1 text-[11px]", step.status === "error" ? "text-destructive" : "text-muted-foreground")}
        >
          {step.summary}
        </motion.p>
      )}
    </StepRow>
  );
}

export function traceMetrics(turn: AssistantTurn) {
  const tools = turn.steps.filter((s): s is Extract<TraceStep, { kind: "tool" }> => s.kind === "tool");
  const records = tools.reduce((sum, s) => sum + (s.status === "ok" ? (s.rows ?? 0) : 0), 0);
  return { queries: tools.length, records };
}

export function AgentTrace({ turn, defaultOpen = true }: { turn: AssistantTurn; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const streaming = turn.status === "streaming";
  const { queries } = traceMetrics(turn);
  const hasActivity = turn.steps.length > 0 || turn.content.length > 0 || !streaming;
  const writing = streaming && turn.content.length > 0;
  const showComposer = turn.content.length > 0 || turn.status === "done";
  const elapsed = turn.latencyMs !== undefined ? `${(turn.latencyMs / 1000).toFixed(1)}s` : null;

  return (
    <div className="bg-muted/30 rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors"
      >
        <span className="bg-gradient-brand flex size-5 items-center justify-center rounded-md text-white">
          <BrainCircuit className="size-3" />
        </span>
        <span className="text-xs font-medium">Agent trace</span>
        <span className="text-muted-foreground truncate text-[11px]">
          {streaming ? (
            <motion.span key={turn.statusLabel} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1">
              {turn.statusLabel}
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="bg-muted-foreground/60 size-0.5 rounded-full"
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </span>
            </motion.span>
          ) : (
            `${queries} ${queries === 1 ? "query" : "queries"}${elapsed ? ` · ${elapsed}` : ""}`
          )}
        </span>
        <ChevronDown className={cn("text-muted-foreground ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <ol className="px-3 pt-1 pb-3">
              <StepRow
                icon={BrainCircuit}
                title="Planning"
                state={hasActivity ? (turn.status === "error" && turn.steps.length === 0 ? "error" : "ok") : "running"}
                last={turn.steps.length === 0 && !showComposer}
              >
                {!hasActivity && <p className="text-muted-foreground mt-0.5 text-[11px]">Choosing which governed queries to run…</p>}
              </StepRow>
              {turn.steps.map((step, i) => {
                const last = i === turn.steps.length - 1 && !showComposer;
                return step.kind === "tool" ? (
                  <ToolStep key={step.id} step={step} last={last} />
                ) : (
                  <StepRow key={step.id} icon={PenLine} title="Reasoning" state="ok" last={last}>
                    <p className="text-muted-foreground mt-0.5 line-clamp-3 text-[11px] italic">{step.text}</p>
                  </StepRow>
                );
              })}
              {showComposer && (
                <StepRow
                  icon={PenLine}
                  title="Composing answer"
                  state={writing ? "running" : turn.status === "done" ? "ok" : turn.status === "error" ? "error" : "idle"}
                  meta={turn.usage ? `${(turn.usage.input_tokens + turn.usage.output_tokens).toLocaleString("en-MY")} tokens` : undefined}
                  last
                />
              )}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

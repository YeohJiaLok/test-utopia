"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowUp, Copy, Database, FileText, RotateCcw, ShieldCheck, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EASE } from "@/components/motion";
import { MAX_QUESTION_CHARS, SUGGESTED_QUESTIONS } from "@/lib/ai/catalogue";
import { linkifyOrders } from "@/lib/ai/linkify";
import { cn } from "@/lib/utils";
import { AgentTrace, traceMetrics } from "./agent-trace";
import { CopilotMarkdown } from "./copilot-markdown";
import { useCopilot, type AssistantTurn } from "./use-copilot";

const orderHref = (orderId: string) => `/manager/orders/${orderId}`;

function AssistantAvatar({ busy }: { busy?: boolean }) {
  return (
    <span className="relative mt-0.5 flex size-7 shrink-0 items-center justify-center">
      {busy && <span className="bg-brand/30 absolute inset-0 animate-ping rounded-lg" />}
      <span className="bg-gradient-brand relative flex size-7 items-center justify-center rounded-lg text-white shadow-sm shadow-sky-500/25">
        <Sparkles className="size-3.5" />
      </span>
    </span>
  );
}

function RecordChips({ turn }: { turn: AssistantTurn }) {
  if (!turn.records.length) return null;
  return (
    <motion.div
      className="flex flex-wrap gap-1.5"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
    >
      {turn.records.map((r) => (
        <motion.div
          key={r.orderId}
          variants={{ hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } }}
        >
          <Link
            href={orderHref(r.orderId)}
            className="group bg-background hover:border-primary/40 hover:bg-primary/5 inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors"
          >
            <FileText className="text-muted-foreground group-hover:text-primary size-3 shrink-0" />
            <span className="font-mono font-medium">{r.orderNo}</span>
            {r.label && <span className="text-muted-foreground truncate">· {r.label}</span>}
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

function AssistantMessage({ turn, isLatest }: { turn: AssistantTurn; isLatest: boolean }) {
  const streaming = turn.status === "streaming";
  const { queries, records } = traceMetrics(turn);
  const content = useMemo(
    () => (turn.status === "done" ? linkifyOrders(turn.content, turn.records, orderHref) : turn.content),
    [turn.status, turn.content, turn.records],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(turn.content);
      toast.success("Answer copied");
    } catch {
      toast.error("Could not access the clipboard");
    }
  }

  return (
    <div className="flex gap-3">
      <AssistantAvatar busy={streaming} />
      <div className="min-w-0 flex-1 space-y-3">
        <AgentTrace turn={turn} defaultOpen={isLatest} />

        {content && (
          <div className="relative">
            <CopilotMarkdown content={content} />
            {streaming && (
              <motion.span
                aria-hidden
                className="bg-primary/70 ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-[1px]"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
            )}
          </div>
        )}

        {turn.status === "error" && (
          <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{turn.error}</span>
          </div>
        )}
        {turn.status === "stopped" && <p className="text-muted-foreground text-xs italic">Stopped.</p>}

        <RecordChips turn={turn} />

        {turn.status === "done" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
          >
            <span className="inline-flex items-center gap-1">
              <Database className="size-3" />
              Grounded in {records.toLocaleString("en-MY")} {records === 1 ? "record" : "records"} · {queries}{" "}
              {queries === 1 ? "query" : "queries"} · {((turn.latencyMs ?? 0) / 1000).toFixed(1)}s
            </span>
            {turn.content && (
              <button type="button" onClick={copy} className="hover:text-foreground inline-flex items-center gap-1 transition-colors">
                <Copy className="size-3" /> Copy
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function EmptyIntro({ onAsk, compact }: { onAsk: (q: string) => void; compact: boolean }) {
  return (
    <div className={cn("flex h-full flex-col justify-center", compact ? "py-6" : "py-10")}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="text-center">
        <div className="bg-gradient-brand mx-auto flex size-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-sky-500/25">
          <Sparkles className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold tracking-tight">Ask about your operations</h2>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm text-pretty">
          I query live jobs, technicians, KPIs and supervisor flags through governed, read-only tools — and show my work.
        </p>
      </motion.div>
      <motion.div
        className={cn("mx-auto mt-6 grid w-full gap-2", compact ? "max-w-md" : "max-w-xl sm:grid-cols-2")}
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
      >
        {SUGGESTED_QUESTIONS.map((q) => (
          <motion.button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } } }}
            whileHover={{ y: -1 }}
            className="bg-card hover:border-primary/40 hover:bg-primary/[0.03] rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors"
          >
            {q}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

/** Ops Copilot conversation UI. `page` = full-height page layout, `drawer` = compact side sheet. */
export function CopilotChat({ variant, className }: { variant: "page" | "drawer"; className?: string }) {
  const { turns, pending, ask, stop, reset } = useCopilot();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const compact = variant === "drawer";
  const tooLong = draft.length > MAX_QUESTION_CHARS;
  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant")?.id;

  // Keep the newest content in view while streaming, unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || pending) el.scrollTo({ top: el.scrollHeight, behavior: pending ? "auto" : "smooth" });
  }, [turns, pending]);

  function submit(question?: string) {
    const q = (question ?? draft).trim();
    if (!q || pending || q.length > MAX_QUESTION_CHARS) return;
    setDraft("");
    void ask(q);
    inputRef.current?.focus();
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className={cn("mx-auto h-full w-full", compact ? "px-4 py-4" : "max-w-3xl px-4 py-6 sm:px-6")}>
          {turns.length === 0 ? (
            <EmptyIntro onAsk={submit} compact={compact} />
          ) : (
            <div className="space-y-6 pb-2">
              <AnimatePresence initial={false}>
                {turns.map((turn) => (
                  <motion.div
                    key={turn.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    {turn.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm">
                          {turn.content}
                        </div>
                      </div>
                    ) : (
                      <AssistantMessage turn={turn} isLatest={turn.id === lastAssistant} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className={cn("bg-background/80 border-t backdrop-blur", compact ? "p-3" : "p-4")}>
        <form
          className={cn("mx-auto w-full", !compact && "max-w-3xl")}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="bg-card focus-within:border-ring focus-within:ring-ring/30 relative flex items-end gap-2 rounded-xl border p-1.5 shadow-sm transition-shadow focus-within:ring-3">
            {turns.length > 0 && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={reset} aria-label="New conversation" title="New conversation" className="mb-0.5">
                <RotateCcw />
              </Button>
            )}
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask about jobs, technicians, workload…"
              aria-label="Ask the Ops Copilot"
              aria-invalid={tooLong || undefined}
              className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {pending ? (
              <Button type="button" size="icon" variant="secondary" onClick={stop} aria-label="Stop generating" className="mb-0.5 shrink-0">
                <Square className="size-3 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!draft.trim() || tooLong} aria-label="Send" className="bg-gradient-brand mb-0.5 shrink-0 text-white">
                <ArrowUp />
              </Button>
            )}
          </div>
          <div className="text-muted-foreground mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3" /> Read-only · RLS-scoped · every run logged
            </span>
            {draft.length > MAX_QUESTION_CHARS * 0.8 && (
              <span className={cn("tabular", tooLong && "text-destructive font-medium")}>
                {draft.length}/{MAX_QUESTION_CHARS}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

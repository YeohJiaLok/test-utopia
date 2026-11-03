"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleDot, Sparkles } from "lucide-react";
import { CountUp, EASE } from "@/components/motion";
import { ORDER_STATUSES, STATUS_META } from "@/lib/workflow";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const WORDS = ["every order.", "every technician.", "every review.", "every ringgit."];

const EVENTS: Record<OrderStatus, { text: string; ai?: string }> = {
  new: { text: "Order created by Aisyah · Admin" },
  assigned: { text: "Assigned to Ali Hassan · WhatsApp sent" },
  in_progress: { text: "Ali started the job on site · Shah Alam" },
  job_done: { text: "6 photos · RM 280.00 collected", ai: "Supervisor: no anomalies" },
  reviewed: { text: "Approved by Daniel · rated 5/5" },
  closed: { text: "Closed · audit trail sealed" },
};

const METRICS = [
  { value: 5, label: "Branches", format: (n: number) => `${Math.round(n)}` },
  { value: 40, label: "Field teams", format: (n: number) => `${Math.round(n)}+` },
  { value: 6, label: "Workflow stages", format: (n: number) => `${Math.round(n)}` },
  { value: 100, label: "AI runs audited", format: (n: number) => `${Math.round(n)}%` },
];

const STEP_MS = 2300;

export function BrandPanel() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const step = tick % ORDER_STATUSES.length;
  const orderNo = 1024 + Math.floor(tick / ORDER_STATUSES.length);
  const word = WORDS[Math.floor(tick / 2) % WORDS.length]!;
  const log = [0, 1, 2]
    .map((i) => tick - i)
    .filter((k) => k >= 0)
    .map((k) => ({ k, status: ORDER_STATUSES[k % ORDER_STATUSES.length]!, no: 1024 + Math.floor(k / ORDER_STATUSES.length) }));

  return (
    <section className="relative hidden max-w-xl lg:block">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3 pl-1.5 text-xs text-white/70 backdrop-blur"
      >
        <span className="rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-950 uppercase">
          New
        </span>
        Agentic AI operations layer, now live
      </motion.div>

      <h1 className="mt-6 text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
        {"The control room for".split(" ").map((w, i) => (
          <motion.span
            key={w + i}
            className="mr-[0.25em] inline-block"
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.08 }}
          >
            {w}
          </motion.span>
        ))}
        <span className="relative block h-[1.15em] overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={word}
              className="absolute inset-x-0 bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 bg-clip-text pb-1 text-transparent"
              initial={{ y: "90%", opacity: 0, filter: "blur(8px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-90%", opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </span>
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.45 }}
        className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60"
      >
        Orders, dispatch, field completion, WhatsApp, manager review and KPIs — one governed system, with an AI layer that only answers
        from real data.
      </motion.p>

      {/* Live workflow card */}
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
        className="relative mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl [@media(max-height:680px)]:hidden"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-white/50">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative size-2 rounded-full bg-emerald-400" />
            </span>
            Live workflow
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={orderNo}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="font-mono text-white/70"
            >
              SJK-2611-0{orderNo}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Pipeline */}
        <div className="relative mt-5">
          <div className="absolute top-3.5 right-3.5 left-3.5 h-px bg-white/10" />
          <motion.div
            className="absolute top-3.5 right-3.5 left-3.5 h-px origin-left bg-gradient-to-r from-sky-400 to-cyan-300 shadow-[0_0_12px_oklch(0.8_0.12_210)]"
            initial={false}
            animate={{ scaleX: step / (ORDER_STATUSES.length - 1) }}
            transition={{ duration: 0.8, ease: EASE }}
          />
          <ol className="relative flex justify-between">
            {ORDER_STATUSES.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s} className="flex w-16 flex-col items-center gap-2 whitespace-nowrap">
                  <motion.span
                    animate={{ scale: current ? 1.12 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className={cn(
                      "relative flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors duration-500",
                      done && "border-sky-400/60 bg-sky-400/90 text-slate-950",
                      current && "border-cyan-200 bg-slate-950 text-cyan-200 shadow-[0_0_18px_oklch(0.82_0.12_210/0.7)]",
                      !done && !current && "border-white/15 bg-slate-950/80 text-white/35",
                    )}
                  >
                    {current && <span className="absolute inset-0 animate-ping rounded-full border border-cyan-200/60" />}
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </motion.span>
                  <span className={cn("text-center text-[10.5px] leading-tight transition-colors duration-500", current ? "text-white" : "text-white/40")}>
                    {STATUS_META[s].label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Event stream */}
        <ul className="mt-5 space-y-1.5 border-t border-white/[0.07] pt-4">
          <AnimatePresence initial={false}>
            {log.map((e, i) => {
              const ev = EVENTS[e.status];
              return (
                <motion.li
                  key={e.k}
                  layout
                  initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  animate={{ opacity: 1 - i * 0.3, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="flex items-center gap-2.5 text-[13px]"
                >
                  <CircleDot className={cn("size-3.5 shrink-0", i === 0 ? "text-cyan-300" : "text-white/30")} />
                  <span className="font-mono text-[11px] text-white/35">0{e.no}</span>
                  <span className="truncate text-white/80">{ev.text}</span>
                  {ev.ai && (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10.5px] text-violet-200">
                      <Sparkles className="size-3" /> {ev.ai}
                    </span>
                  )}
                  {!ev.ai && <span className="ml-auto shrink-0 text-[11px] text-white/30">{i === 0 ? "now" : `${i * 2}s ago`}</span>}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </motion.div>

      {/* Metrics */}
      <motion.dl
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.8 }}
        className="mt-8 grid grid-cols-4 divide-x divide-white/[0.08] [@media(max-height:820px)]:hidden"
      >
        {METRICS.map((m) => (
          <div key={m.label} className="px-4 first:pl-0">
            <dt className="text-[11px] tracking-wide whitespace-nowrap text-white/40 uppercase">{m.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-white tabular-nums">
              <CountUp value={m.value} format={m.format} duration={1.6} />
            </dd>
          </div>
        ))}
      </motion.dl>
    </section>
  );
}

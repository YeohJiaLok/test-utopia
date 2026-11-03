"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ShieldCheck, Smartphone, Snowflake, Workflow } from "lucide-react";
import { EASE } from "@/components/motion";
import { StatusBadge } from "@/components/shared/status-badge";
import { ORDER_STATUSES } from "@/lib/workflow";

const FEATURES = [
  { icon: Workflow, title: "Enforced workflow", text: "New → Assigned → In Progress → Job Done → Reviewed → Closed, guarded in the database." },
  { icon: Smartphone, title: "Field-first", text: "Technicians close jobs from their phone in under a minute." },
  { icon: Bot, title: "Agentic AI", text: "Copilot, supervisor and document intelligence — grounded in governed queries." },
  { icon: ShieldCheck, title: "Traceable", text: "Every action and every AI decision lands in an audit log." },
];

export function BrandPanel() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % ORDER_STATUSES.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
      <motion.div
        className="absolute -top-40 -left-40 size-[520px] rounded-full bg-sky-500/30 blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 -bottom-40 size-[460px] rounded-full bg-cyan-400/20 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-center gap-2.5">
        <span className="bg-gradient-brand flex size-9 items-center justify-center rounded-xl shadow-lg shadow-sky-500/30">
          <Snowflake className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Sejuk Ops</p>
          <p className="text-xs text-white/60">Sejuk Sejuk Service Sdn Bhd</p>
        </div>
      </div>

      <div className="relative max-w-lg">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-4xl leading-tight font-semibold tracking-tight text-balance"
        >
          Every aircond job, from order to <span className="text-gradient-brand">closed</span> — in one system.
        </motion.h2>
        <p className="mt-4 text-white/65">
          5 branches · 40+ field teams · one operational source of truth with an AI layer that only answers from real data.
        </p>

        <div className="mt-8 flex h-24 items-center rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex-1">
            <p className="text-xs text-white/50">Order SJK-2611-01024 · Aircond cleaning</p>
            <p className="mt-1 text-sm font-medium">Ahmad · Shah Alam</p>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="rounded-full bg-white/90"
            >
              <StatusBadge status={ORDER_STATUSES[step]!} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.08 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <f.icon className="size-4 text-sky-300" />
              <p className="mt-2 text-sm font-medium">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-white/40">Internal operations tool · Built with Next.js, Supabase & Claude</p>
    </aside>
  );
}

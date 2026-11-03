"use client";

import { motion } from "motion/react";
import { CountUp, EASE } from "@/components/motion";
import { formatMYR } from "@/lib/format";

const money = (n: number) => formatMYR(n);
const count = (n: number) => Math.round(n).toString();

/** "This week" totals card on the technician history screen (weeks start Monday, MYT). */
export function WeekSummary({
  jobs,
  billed,
  collected,
  extras,
}: {
  jobs: number;
  billed: number;
  collected: number;
  extras: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
      className="bg-gradient-brand relative overflow-hidden rounded-2xl p-5 text-white shadow-lg shadow-brand/20 lg:p-6"
    >
      <div className="pointer-events-none absolute -top-14 -right-10 size-44 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 hidden size-56 rounded-full bg-white/10 blur-3xl lg:block" />
      <div className="relative lg:flex lg:items-center lg:gap-8">
        <div className="lg:min-w-64">
          <p className="text-xs font-semibold tracking-wider text-white/80 uppercase">This week</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-3xl font-semibold tracking-tight lg:text-4xl">
                <CountUp value={billed} format={money} />
              </p>
              <p className="text-xs text-white/85">billed across completed jobs</p>
            </div>
            <div className="text-right lg:hidden">
              <p className="text-3xl font-semibold tracking-tight">
                <CountUp value={jobs} format={count} />
              </p>
              <p className="text-xs text-white/85">jobs done</p>
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm lg:mt-0 lg:flex-1 lg:grid-cols-3 lg:gap-3">
          <div className="hidden rounded-xl bg-white/12 px-4 py-3 lg:block">
            <dt className="text-xs text-white/80">Jobs done</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{jobs}</dd>
          </div>
          <div className="rounded-xl bg-white/12 px-3 py-2 lg:px-4 lg:py-3">
            <dt className="text-[11px] text-white/80 lg:text-xs">Collected on site</dt>
            <dd className="font-semibold tabular-nums lg:mt-0.5 lg:text-xl">{formatMYR(collected)}</dd>
          </div>
          <div className="rounded-xl bg-white/12 px-3 py-2 lg:px-4 lg:py-3">
            <dt className="text-[11px] text-white/80 lg:text-xs">Extra charges</dt>
            <dd className="font-semibold tabular-nums lg:mt-0.5 lg:text-xl">{formatMYR(extras)}</dd>
          </div>
        </dl>
      </div>
    </motion.section>
  );
}

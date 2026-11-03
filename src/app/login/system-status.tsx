"use client";

import { useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function subscribe(cb: () => void) {
  const t = setInterval(cb, 5_000);
  return () => clearInterval(t);
}

/** "All systems operational" pill with a live Malaysia-time clock (client-only to avoid hydration drift). */
export function SystemStatus() {
  const now = useSyncExternalStore(
    subscribe,
    () => fmt.format(new Date()),
    () => null,
  );

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5 text-emerald-200/90 sm:inline-flex">
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300" />
          <span className="relative size-1.5 rounded-full bg-emerald-300" />
        </span>
        All systems operational
      </span>
      <span className="min-w-[9.5rem] text-right font-mono text-white/45 tabular-nums">{now ? `${now} MYT` : ""}</span>
    </div>
  );
}

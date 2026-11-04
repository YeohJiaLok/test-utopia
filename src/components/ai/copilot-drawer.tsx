"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Maximize2, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CopilotChat } from "./copilot-chat";
import { useCopilot } from "./use-copilot";

const ASSISTANT_PATH = "/manager/assistant";

/** Pages with a fixed bar or button at the bottom on phones: lift the launcher above it. */
const RAISED_ON_MOBILE = [/^\/admin\/orders(\/new)?$/, /^\/admin\/orders\/[^/]+$/, /^\/manager\/orders\/[^/]+$/];

function HeaderButton({ label, children, ...props }: { label: string; children: React.ReactNode } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="size-9 text-white/85 hover:bg-white/15 hover:text-white sm:size-8"
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Sejuk Ops AI: floating assistant for office roles (admin, manager). The launcher sits
 * bottom-right; the chat window grows out of it (full screen on phones). The conversation
 * lives in a module store, so it survives closing the window and moving between pages.
 */
export function CopilotDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(null);
  const { turns, pending, reset } = useCopilot();
  const hidden = pathname === ASSISTANT_PATH || pathname.startsWith(`${ASSISTANT_PATH}/`);
  const raised = RAISED_ON_MOBILE.some((r) => r.test(pathname));

  const lastDone = [...turns].reverse().find((t) => t.role === "assistant" && t.status !== "streaming")?.id ?? null;
  const unread = !open && !pending && lastDone !== null && lastDone !== seenId;

  function toggle(next: boolean) {
    setOpen(next);
    setSeenId(lastDone);
  }

  // Escape closes the window.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            key="assistant"
            role="dialog"
            aria-label="Sejuk Ops AI assistant"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{ transformOrigin: "bottom right" }}
            className={cn(
              "bg-background fixed inset-0 z-50 flex flex-col overflow-hidden",
              "sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(680px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:shadow-2xl sm:shadow-black/20",
              "lg:right-8 lg:bottom-28",
            )}
          >
            {/* Header */}
            <header className="bg-gradient-brand relative shrink-0 overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
              <span aria-hidden className="absolute -top-16 -right-10 size-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                  <Sparkles className="size-5" />
                  <span className="ring-primary absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-emerald-400 ring-2" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] leading-tight font-semibold">Sejuk Ops AI</h2>
                  <p className="truncate text-xs text-white/75">
                    {pending ? "Analysing live data…" : "Operations assistant · online"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <HeaderButton label="New conversation" onClick={reset} disabled={!turns.length || pending}>
                    <RotateCcw />
                  </HeaderButton>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          href={ASSISTANT_PATH}
                          onClick={() => setOpen(false)}
                          aria-label="Open full screen"
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon-sm" }),
                            "hidden size-8 text-white/85 hover:bg-white/15 hover:text-white sm:inline-flex",
                          )}
                        />
                      }
                    >
                      <Maximize2 />
                    </TooltipTrigger>
                    <TooltipContent>Open full screen</TooltipContent>
                  </Tooltip>
                  <HeaderButton label="Close" onClick={() => toggle(false)}>
                    <X className="sm:hidden" />
                    <ChevronDown className="hidden sm:block" />
                  </HeaderButton>
                </div>
              </div>
            </header>

            {/* Scope */}
            <div className="bg-muted/50 text-muted-foreground flex shrink-0 items-center gap-2 border-b px-4 py-2 text-[11px]">
              <ShieldCheck className="text-primary size-3.5 shrink-0" />
              <span className="min-w-0">
                Operations only: jobs, technicians, schedules, workload, revenue. Read-only, and every question is logged.
              </span>
            </div>

            <CopilotChat variant="drawer" className="min-h-0 flex-1" />
          </motion.section>
        )}
      </AnimatePresence>

      {/* Launcher (hidden behind the full-screen window on phones) */}
      <div
        className={cn(
          "group fixed right-4 z-50 flex items-center gap-3 sm:right-6 lg:right-8",
          raised ? "bottom-24 sm:bottom-6 lg:bottom-8" : "bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 lg:bottom-8",
          open && "max-sm:hidden",
        )}
      >
        <AnimatePresence>
          {!open && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="bg-foreground text-background pointer-events-none hidden rounded-full px-3 py-1.5 text-xs font-medium opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block"
            >
              Ask Sejuk AI
            </motion.span>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={() => toggle(!open)}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 24, delay: 0.3 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          aria-label={open ? "Close Sejuk Ops AI" : "Open Sejuk Ops AI"}
          aria-expanded={open}
          className="bg-gradient-brand shadow-brand/40 relative flex size-14 items-center justify-center rounded-full text-white shadow-xl ring-4 ring-white/60 dark:ring-white/10"
        >
          {!open && <span aria-hidden className="bg-brand/40 absolute inset-0 -z-10 animate-ping rounded-full [animation-duration:2.8s]" />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? "close" : "open"}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              {open ? <ChevronDown className="size-6" /> : <Sparkles className="size-6" />}
            </motion.span>
          </AnimatePresence>
          {(unread || (pending && !open)) && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-900">
              {pending ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : <span className="sr-only">New answer</span>}
            </span>
          )}
        </motion.button>
      </div>
    </>
  );
}

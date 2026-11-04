"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, History, Maximize2, MessageSquarePlus, Minimize2, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CopilotChat } from "./copilot-chat";
import { CopilotHistory } from "./copilot-history";
import { bindCopilotOwner, useCopilot } from "./use-copilot";

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
 * Sejuk Ops AI: floating assistant for office roles (admin, manager), the only entry point
 * to the Ops Copilot. The launcher sits bottom-right; the chat window grows out of it and can
 * expand in place for charts and tables (full screen on phones). The conversation lives in a
 * module store, so it survives closing the window and moving between pages.
 */
export function CopilotDrawer({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [seenId, setSeenId] = useState<string | null>(null);
  const { turns, pending, reset, conversationId, title, openConversation, renamed, forget } = useCopilot();

  // Before paint: a different signed-in user never sees the previous user's conversation.
  useLayoutEffect(() => bindCopilotOwner(userId), [userId]);
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
              "bg-ai-surface fixed inset-0 z-50 flex flex-col overflow-hidden",
              "sm:inset-auto sm:right-6 sm:bottom-24 sm:rounded-2xl sm:border sm:shadow-[0_24px_70px_-12px_rgb(0_0_0/0.35)]",
              // Expand grows the same window in place (smooth width/height transition), never another page.
              "sm:transition-[width,height] sm:duration-500 sm:ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded
                ? "sm:h-[calc(100dvh-8rem)] sm:w-[min(880px,calc(100vw-3rem))]"
                : "sm:h-[min(680px,calc(100dvh-8rem))] sm:w-[400px]",
              "dark:sm:border-white/12 dark:sm:shadow-[0_28px_90px_-10px_rgb(0_0_0/0.85),0_0_0_1px_rgb(255_255_255/0.04)]",
              "lg:right-8 lg:bottom-28",
            )}
          >
            {/* Header */}
            <header className="bg-gradient-ai relative shrink-0 overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
              <span aria-hidden className="absolute -top-16 -right-10 size-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                  <Sparkles className="size-5" />
                  <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-[var(--ai-1)]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] leading-tight font-semibold">Sejuk Ops AI</h2>
                  <p className="truncate text-xs text-white/75">
                    {pending ? "Analysing live data…" : view === "history" ? "Your conversations" : (title ?? "Operations assistant · online")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <HeaderButton
                    label={view === "history" ? "Back to chat" : "History"}
                    onClick={() => setView((v) => (v === "history" ? "chat" : "history"))}
                    aria-pressed={view === "history"}
                    className={cn(
                      "size-9 text-white/85 hover:bg-white/15 hover:text-white sm:size-8",
                      view === "history" && "bg-white/20 text-white",
                    )}
                  >
                    <History />
                  </HeaderButton>
                  <HeaderButton
                    label="New conversation"
                    onClick={() => {
                      reset();
                      setView("chat");
                    }}
                    disabled={pending || (!turns.length && view === "chat")}
                  >
                    <MessageSquarePlus />
                  </HeaderButton>
                  <HeaderButton
                    label={expanded ? "Restore size" : "Expand"}
                    onClick={() => setExpanded((v) => !v)}
                    aria-pressed={expanded}
                    className="hidden size-8 text-white/85 hover:bg-white/15 hover:text-white sm:inline-flex"
                  >
                    {expanded ? <Minimize2 /> : <Maximize2 />}
                  </HeaderButton>
                  <HeaderButton label="Close" onClick={() => toggle(false)}>
                    <X className="sm:hidden" />
                    <ChevronDown className="hidden sm:block" />
                  </HeaderButton>
                </div>
              </div>
            </header>

            {/* Scope */}
            <div className="text-muted-foreground flex shrink-0 items-center gap-2 border-b bg-[color-mix(in_oklch,var(--ai-2)_6%,transparent)] px-4 py-2 text-[11px] dark:border-white/8">
              <ShieldCheck className="size-3.5 shrink-0 text-[var(--ai-2)] dark:text-violet-300" />
              <span className="min-w-0">
                Operations only: jobs, technicians, schedules, workload, revenue. Read-only, and every question is logged.
              </span>
            </div>

            <div className="relative min-h-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                {view === "history" ? (
                  <motion.div
                    key="history"
                    className="absolute inset-0"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <CopilotHistory
                      activeId={conversationId}
                      onOpen={async (id) => {
                        if (await openConversation(id)) setView("chat");
                      }}
                      onNew={() => {
                        reset();
                        setView("chat");
                      }}
                      onRenamed={renamed}
                      onDeleted={forget}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    className="absolute inset-0 flex flex-col"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <CopilotChat variant="drawer" className="min-h-0 flex-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
          className="bg-gradient-ai relative flex size-14 items-center justify-center rounded-full text-white shadow-xl shadow-[color-mix(in_oklch,var(--ai-2)_45%,transparent)] ring-4 ring-white/70 dark:ring-white/10"
        >
          {!open && <span aria-hidden className="absolute inset-0 -z-10 animate-ping rounded-full bg-[color-mix(in_oklch,var(--ai-2)_40%,transparent)] [animation-duration:2.8s]" />}
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

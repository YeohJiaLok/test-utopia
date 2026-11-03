"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { EASE } from "@/components/motion";
import { CopilotChat } from "./copilot-chat";
import { useCopilot } from "./use-copilot";

const ASSISTANT_PATH = "/manager/assistant";

/** Floating Ops Copilot launcher + right-side sheet (mounted by the app shell for managers). */
export function CopilotDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { pending } = useCopilot();
  const hidden = pathname === ASSISTANT_PATH || pathname.startsWith(`${ASSISTANT_PATH}/`);

  return (
    <>
      <AnimatePresence>
        {!hidden && !open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            transition={{ duration: 0.3, ease: EASE }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Open Ops Copilot"
            className="bg-gradient-brand animate-pulse-ring fixed right-5 bottom-5 z-40 flex h-12 items-center gap-2 rounded-full pr-4 pl-3.5 text-sm font-medium text-white shadow-lg shadow-sky-500/30 lg:right-8 lg:bottom-8"
          >
            <Sparkles className="size-5" />
            <span className="hidden sm:inline">Ask Copilot</span>
            {pending && <span className="size-2 animate-pulse rounded-full bg-white" aria-label="Answer in progress" />}
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={open && !hidden} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
          <div className="flex items-center gap-3 border-b px-4 py-3 pr-12">
            <span className="bg-gradient-brand flex size-8 items-center justify-center rounded-lg text-white shadow-sm shadow-sky-500/25">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold">Ops Copilot</SheetTitle>
              <SheetDescription className="text-xs">Governed AI agent over live operations data</SheetDescription>
            </div>
            <Link
              href={ASSISTANT_PATH}
              onClick={() => setOpen(false)}
              aria-label="Open full screen"
              title="Open full screen"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Maximize2 />
            </Link>
          </div>
          <CopilotChat variant="drawer" className="min-h-0 flex-1" />
        </SheetContent>
      </Sheet>
    </>
  );
}

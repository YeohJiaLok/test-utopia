"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {/* reducedMotion="user" makes every motion component honour prefers-reduced-motion */}
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        <TooltipProvider delay={200}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

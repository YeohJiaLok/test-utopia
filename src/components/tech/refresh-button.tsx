"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Re-fetches the current server page (new assignments, status changes) without a full reload. */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="Refresh jobs"
      className={cn(
        "bg-card text-muted-foreground hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-colors active:scale-95 disabled:opacity-70",
        className,
      )}
    >
      <RefreshCw className={cn("size-[18px]", pending && "text-primary animate-spin")} />
    </button>
  );
}

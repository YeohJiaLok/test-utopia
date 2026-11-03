"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Pretty-printed, lightly syntax-coloured JSON with a copy button. */
export function JsonBlock({ value, className, maxHeight = "max-h-72" }: { value: unknown; className?: string; maxHeight?: string }) {
  const text = JSON.stringify(value ?? null, null, 2);
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    const [whole, str, colon, lit, num] = m;
    if (str && colon) {
      parts.push(
        <span key={i} className="text-primary">
          {str}
        </span>,
        colon,
      );
    } else if (str) {
      parts.push(
        <span key={i} className="text-emerald-700 dark:text-emerald-300">
          {str}
        </span>,
      );
    } else if (lit || num) {
      parts.push(
        <span key={i} className="text-amber-700 dark:text-amber-300">
          {whole}
        </span>,
      );
    } else parts.push(whole);
    last = i + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <div className={cn("bg-muted/40 relative rounded-lg border", className)}>
      <CopyButton text={text} label="Copy JSON" className="absolute top-1.5 right-1.5" />
      <pre className={cn("scrollbar-thin overflow-auto p-3 pr-10 font-mono text-[11.5px] leading-relaxed", maxHeight)}>
        <code>{parts}</code>
      </pre>
    </div>
  );
}

export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Could not copy to the clipboard");
        }
      }}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-background inline-flex size-7 items-center justify-center rounded-md transition-colors",
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </button>
  );
}

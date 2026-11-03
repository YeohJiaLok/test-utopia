"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const RATING_LABELS = ["", "Poor", "Below standard", "Acceptable", "Good", "Excellent"] as const;

/** Accessible 1–5 star radio group with hover preview and a springy fill on selection. */
export function StarRating({
  value,
  onChange,
  disabled,
  invalid,
  id,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover ?? value ?? 0;

  const move = (to: number) => {
    const v = Math.min(5, Math.max(1, to));
    onChange(v);
    refs.current[v - 1]?.focus();
  };

  return (
    <div className="flex items-center gap-3">
      <div
        id={id}
        role="radiogroup"
        aria-label="Job quality rating"
        aria-invalid={invalid || undefined}
        className={cn("flex items-center gap-0.5 rounded-lg", invalid && "ring-destructive/40 ring-2 ring-offset-2 ring-offset-card")}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= shown;
          const checked = value === n;
          return (
            <motion.button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${n} star${n > 1 ? "s" : ""} – ${RATING_LABELS[n]}`}
              tabIndex={checked || (value === null && n === 1) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  move((value ?? 0) + 1);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  move((value ?? 2) - 1);
                }
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className="focus-visible:ring-ring/50 rounded-md p-1 outline-none focus-visible:ring-2 disabled:opacity-50"
            >
              <motion.span
                className="block"
                animate={checked ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
                transition={{ duration: 0.35 }}
              >
                <Star
                  className={cn(
                    "size-7 transition-colors duration-150",
                    filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 fill-transparent",
                  )}
                  aria-hidden
                />
              </motion.span>
            </motion.button>
          );
        })}
      </div>
      <span className="text-muted-foreground min-w-24 text-xs font-medium" aria-live="polite">
        {shown ? RATING_LABELS[shown] : "Not rated"}
      </span>
    </div>
  );
}

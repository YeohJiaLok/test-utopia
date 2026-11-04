"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * Six-digit one-time-code input. A single real <input> sits over the six boxes, so paste,
 * SMS/authenticator autofill (autocomplete="one-time-code"), the numeric keypad and screen
 * readers all behave like a normal field. Calls onComplete once all digits are entered.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
  id,
  name,
  "aria-label": ariaLabel = "6-digit code",
  className,
  cellClassName,
  activeCellClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  id?: string;
  /** Form field name, so the code is submitted with a plain <form>. */
  name?: string;
  "aria-label"?: string;
  className?: string;
  /** Box styling (light app theme by default; the login screen passes its dark style). */
  cellClassName?: string;
  activeCellClassName?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  function set(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    onChange(digits);
    if (digits.length === LENGTH && digits !== value) onComplete?.(digits);
  }

  return (
    <motion.div
      className={cn("relative flex justify-between gap-2", className)}
      animate={invalid ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      onClick={() => ref.current?.focus()}
    >
      {Array.from({ length: LENGTH }, (_, i) => {
        const char = value[i] ?? "";
        const active = focused && !disabled && (i === value.length || (i === LENGTH - 1 && value.length === LENGTH));
        return (
          <div
            key={i}
            aria-hidden
            className={cn(
              "bg-background relative flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg border text-xl font-semibold tabular-nums transition-[border-color,box-shadow] duration-200 sm:h-13",
              invalid && "border-destructive/60",
              cellClassName,
              active && (activeCellClassName ?? "border-ring ring-ring/25 ring-3"),
              disabled && "opacity-60",
            )}
          >
            {char ? (
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }}>
                {char}
              </motion.span>
            ) : (
              active && <span className="bg-foreground/70 h-5 w-px animate-pulse" />
            )}
            {/* Visual gap between the two groups of three, like authenticator apps show it. */}
            {i === 2 && <span className="bg-border absolute top-1/2 -right-[7px] hidden h-px w-1.5 sm:block" />}
          </div>
        );
      })}
      <input
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        // 16px+ text so iOS doesn't zoom; transparent so the boxes show through.
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
    </motion.div>
  );
}

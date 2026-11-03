import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Label + control + hint/error, consistent spacing across all forms. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  aside,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  /** Right-aligned element on the label row (e.g. "AI-filled" chip) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-[13px]">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-destructive text-xs font-medium">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

/** Styled native <select>: best UX on mobile (OS picker) and trivially form-friendly. */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-11 w-full appearance-none rounded-lg border pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:ring-3 disabled:opacity-50 sm:h-9 sm:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

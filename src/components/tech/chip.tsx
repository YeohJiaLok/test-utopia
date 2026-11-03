import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large, tappable toggle chip (≥44px) used for quick-picks across the technician flows. */
export function Chip({
  selected,
  showCheck = true,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean; showCheck?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-primary/50 bg-primary/10 text-primary"
          : "bg-background text-foreground/85 hover:bg-muted",
        className,
      )}
      {...props}
    >
      {selected && showCheck && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

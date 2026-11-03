import { cn } from "@/lib/utils";

/** Compact titled card used on technician screens. */
export function SectionCard({
  title,
  aside,
  className,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card rounded-2xl border p-4 shadow-xs", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

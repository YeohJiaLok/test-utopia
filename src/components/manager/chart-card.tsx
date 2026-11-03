import { cn } from "@/lib/utils";

/** Card frame shared by dashboard panels: title, one-line description, optional action slot. */
export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-card flex min-w-0 flex-col rounded-xl border shadow-xs", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </header>
      <div className="min-w-0 flex-1 px-4 pt-3 pb-4 sm:px-5">{children}</div>
    </section>
  );
}

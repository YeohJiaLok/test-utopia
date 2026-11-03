import { cn } from "@/lib/utils";

/** Card frame shared by dashboard panels: optional icon, title, one-line description, optional action slot. */
export function ChartCard({
  title,
  description,
  icon,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** Rendered icon element, e.g. `<Activity />` — shown in a tinted tile before the title. */
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-card flex min-w-0 flex-col rounded-xl border shadow-xs transition-shadow duration-300 hover:shadow-sm",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && (
            <span
              aria-hidden
              className="bg-primary/8 text-primary ring-primary/10 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset [&_svg]:size-4"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm leading-5 font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-muted-foreground mt-0.5 text-xs text-pretty">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn("min-w-0 flex-1 px-4 pt-3 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

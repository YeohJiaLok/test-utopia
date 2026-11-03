import { CheckCircle2, Cog, Lightbulb, Sparkles } from "lucide-react";
import { SeverityBadge } from "@/components/shared/status-badge";
import type { AiFlag } from "@/lib/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEVERITY_EDGE: Record<AiFlag["severity"], string> = {
  high: "before:bg-red-500",
  medium: "before:bg-amber-500",
  low: "before:bg-slate-400",
};

export function FlagSource({ flag }: { flag: Pick<AiFlag, "source" | "rule_code"> }) {
  return flag.source === "ai" ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
      <Sparkles className="size-3" aria-hidden /> AI reviewer
    </span>
  ) : (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium">
      <Cog className="size-3" aria-hidden /> Rule <span className="font-mono">{flag.rule_code}</span>
    </span>
  );
}

/** One AI Supervisor finding: severity, source (rule engine / AI reviewer), explanation and recommended action. */
export function FlagCard({
  flag,
  header,
  action,
  resolverName,
  className,
}: {
  flag: AiFlag;
  /** Optional line above the title (e.g. order link in the inbox) */
  header?: React.ReactNode;
  action?: React.ReactNode;
  resolverName?: string | null;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "bg-card relative overflow-hidden rounded-xl border p-4 pl-5 shadow-xs before:absolute before:inset-y-0 before:left-0 before:w-1",
        flag.resolved ? "before:bg-emerald-500/60" : SEVERITY_EDGE[flag.severity],
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={flag.severity} />
        <FlagSource flag={flag} />
        {header}
        <time className="text-muted-foreground ml-auto text-[11px]" dateTime={flag.created_at} title={formatDateTime(flag.created_at)}>
          {formatRelative(flag.created_at)}
        </time>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{flag.title}</h3>
      <p className="text-muted-foreground mt-1 text-sm text-pretty">{flag.explanation}</p>
      {flag.recommended_action && (
        <p className="bg-primary/5 mt-3 flex gap-2 rounded-lg px-3 py-2 text-xs">
          <Lightbulb className="text-primary mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Recommended: </span>
            {flag.recommended_action}
          </span>
        </p>
      )}
      {flag.resolved ? (
        <div className="mt-3 flex gap-2 rounded-lg bg-emerald-500/8 px-3 py-2 text-xs">
          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              Resolved{resolverName ? ` by ${resolverName}` : ""} · {formatRelative(flag.resolved_at)}
            </p>
            {flag.resolution_note && <p className="text-muted-foreground mt-0.5">{flag.resolution_note}</p>}
          </div>
        </div>
      ) : (
        action && <div className="mt-3 flex justify-end">{action}</div>
      )}
    </article>
  );
}

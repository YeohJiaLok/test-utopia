import Link from "next/link";
import { ArrowUpRight, Phone, Star, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMYR, initials } from "@/lib/format";
import { getRange } from "@/lib/time";
import { telLink } from "@/lib/whatsapp";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { LOAD_META, LoadMeter, loadLevel } from "@/components/admin/load-meter";
import { cn } from "@/lib/utils";
import { getRoster, getTechnicianWeekKpis, type RosterTechnician } from "../_lib/queries";

export const metadata = { title: "Technicians · Sejuk Ops" };

function Metric({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-muted-foreground truncate text-[11px]">{label}</p>
      <p className="text-sm font-semibold tabular">{value}</p>
    </div>
  );
}

export default async function TechniciansPage() {
  await requireUser(["admin"]);
  const [roster, kpis] = await Promise.all([getRoster(), getTechnicianWeekKpis()]);
  const week = getRange("this_week");

  const groups = new Map<string, { name: string; state: string; techs: RosterTechnician[] }>();
  for (const t of roster) {
    const key = t.branch?.code ?? "—";
    if (!groups.has(key)) groups.set(key, { name: t.branch?.name ?? "No branch", state: t.branch?.state ?? "", techs: [] });
    groups.get(key)!.techs.push(t);
  }

  const active = roster.filter((t) => t.active);
  const totals = active.reduce(
    (acc, t) => {
      const k = kpis.get(t.id);
      acc.open += k?.open_jobs ?? 0;
      acc.done += k?.jobs_completed ?? 0;
      acc.free += (k?.open_jobs ?? 0) === 0 ? 1 : 0;
      return acc;
    },
    { open: 0, done: 0, free: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field teams"
        title="Technicians"
        description="Roster by branch with live workload and this week's output (weeks start Monday, Malaysia time)."
      />

      <FadeIn className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border shadow-xs sm:grid-cols-4">
        {[
          { label: "Active technicians", value: active.length },
          { label: "Available now", value: totals.free },
          { label: "Open jobs", value: totals.open },
          { label: "Completed this week", value: totals.done },
        ].map((s) => (
          <div key={s.label} className="bg-card p-4">
            <p className="text-muted-foreground text-xs">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular">{s.value.toLocaleString("en-MY")}</p>
          </div>
        ))}
      </FadeIn>

      {roster.length === 0 ? (
        <EmptyState icon={Users} title="No technicians yet" description="Technicians added to the system will appear here grouped by branch." />
      ) : (
        [...groups.entries()].map(([code, g], gi) => {
          const groupOpen = g.techs.reduce((n, t) => n + (kpis.get(t.id)?.open_jobs ?? 0), 0);
          const groupDone = g.techs.reduce((n, t) => n + (kpis.get(t.id)?.jobs_completed ?? 0), 0);
          return (
            <section key={code} className="space-y-3" aria-labelledby={`branch-${code}`}>
              <FadeIn delay={0.05 + gi * 0.05} className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`branch-${code}`} className="text-base font-semibold">
                  {g.name}
                  {g.state && <span className="text-muted-foreground ml-2 text-sm font-normal">{g.state}</span>}
                </h2>
                <p className="text-muted-foreground text-xs tabular">
                  {g.techs.length} technician{g.techs.length === 1 ? "" : "s"} · {groupOpen} open · {groupDone} done this week
                </p>
              </FadeIn>
              <Stagger delay={0.1 + gi * 0.05} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.techs.map((t) => {
                  const k = kpis.get(t.id);
                  const open = k?.open_jobs ?? 0;
                  const level = loadLevel(open);
                  return (
                    <StaggerItem key={t.id} className={cn("bg-card flex flex-col rounded-xl border p-4 shadow-xs", !t.active && "opacity-60")}>
                      <div className="flex items-start gap-3">
                        <span className="bg-primary/10 text-primary relative flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                          {initials(t.name)}
                          {t.active && (
                            <span className={cn("ring-card absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2", LOAD_META[level].dot)} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{t.name}</p>
                            <span className="bg-muted shrink-0 rounded px-1.5 py-px font-mono text-[10px] font-semibold">{t.team_code}</span>
                          </div>
                          <a href={telLink(t.phone)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs tabular">
                            <Phone className="size-3" /> {t.phone}
                          </a>
                        </div>
                        {!t.active && <span className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-medium">Inactive</span>}
                      </div>

                      <div className="mt-3 flex min-h-6 flex-wrap gap-1">
                        {t.skills.length ? (
                          t.skills.map((s) => (
                            <span key={s} className="bg-primary/6 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">General servicing</span>
                        )}
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn("font-medium", t.active ? LOAD_META[level].text : "text-muted-foreground")}>
                            {t.active ? LOAD_META[level].label : "Not dispatchable"}
                          </span>
                          <span className="text-muted-foreground tabular">{open} open</span>
                        </div>
                        <LoadMeter openJobs={open} />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
                        <Metric label="Done this week" value={k?.jobs_completed ?? 0} />
                        <Metric label="Revenue" value={formatMYR(k?.total_amount ?? 0, { compact: true })} />
                        <Metric
                          label="Rating"
                          value={
                            k?.avg_rating ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="size-3 fill-amber-400 text-amber-400" />
                                {k.avg_rating.toFixed(1)}
                              </span>
                            ) : (
                              "—"
                            )
                          }
                        />
                      </div>

                      <Link
                        href={`/admin/orders?tech=${t.id}`}
                        className="text-primary mt-3 inline-flex items-center gap-1 self-start text-xs font-medium hover:underline"
                      >
                        View jobs <ArrowUpRight className="size-3" />
                      </Link>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            </section>
          );
        })
      )}
      <p className="text-muted-foreground text-center text-[11px]">
        Weekly figures cover {formatDate(week.from)} – {formatDate(new Date(new Date(week.to).getTime() - 1))} (MYT)
      </p>
    </div>
  );
}

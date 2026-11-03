import Link from "next/link";
import { ArrowRight, Briefcase, CheckCheck, CircleCheck, MapPin, Phone, Star, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMYR, initials } from "@/lib/format";
import { getRange } from "@/lib/time";
import { telLink } from "@/lib/whatsapp";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { MetricStrip } from "@/components/admin/metric-strip";
import { LoadMeter } from "@/components/admin/load-meter";
import { LOAD_CAPACITY, LOAD_META, loadLevel } from "@/components/admin/load-level";
import { cn } from "@/lib/utils";
import { getRoster, getTechnicianWeekKpis, type RosterTechnician } from "../_lib/queries";

export const metadata = { title: "Technicians · Sejuk Ops" };

function Metric({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted-foreground truncate text-[11px]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular">{value}</dd>
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
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Field teams"
          title="Technicians"
          description="Roster by branch with live workload and this week's output (weeks start Monday, Malaysia time)."
        />
        <MetricStrip
          items={[
            {
              label: "Active technicians",
              value: active.length,
              icon: <Users />,
              hint: `Across ${groups.size} branch${groups.size === 1 ? "" : "es"}`,
            },
            {
              label: "Available now",
              value: totals.free,
              icon: <CircleCheck />,
              hint: totals.free ? "No open jobs" : "Everyone has work",
              tone: totals.free ? "good" : "default",
            },
            { label: "Open jobs", value: totals.open, icon: <Briefcase />, hint: "Assigned or on site" },
            { label: "Done this week", value: totals.done, icon: <CheckCheck />, hint: "Job Done or later" },
          ]}
        />
      </div>

      {roster.length === 0 ? (
        <EmptyState icon={Users} title="No technicians yet" description="Technicians added to the system will appear here grouped by branch." />
      ) : (
        [...groups.entries()].map(([code, g], gi) => {
          const groupOpen = g.techs.reduce((n, t) => n + (kpis.get(t.id)?.open_jobs ?? 0), 0);
          const groupDone = g.techs.reduce((n, t) => n + (kpis.get(t.id)?.jobs_completed ?? 0), 0);
          return (
            <section key={code} className="space-y-3" aria-labelledby={`branch-${code}`}>
              <FadeIn delay={0.05 + gi * 0.05} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="bg-primary/8 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 id={`branch-${code}`} className="truncate text-base leading-tight font-semibold">
                      {g.name}
                    </h2>
                    {g.state && <p className="text-muted-foreground text-xs">{g.state}</p>}
                  </div>
                </div>
                <dl className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { k: "Technicians", v: g.techs.length },
                    { k: "Open", v: groupOpen },
                    { k: "Done this week", v: groupDone },
                  ].map((x) => (
                    <div key={x.k} className="bg-card inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5">
                      <dt>{x.k}</dt>
                      <dd className="text-foreground font-semibold tabular">{x.v}</dd>
                    </div>
                  ))}
                </dl>
              </FadeIn>
              <Stagger delay={0.1 + gi * 0.05} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.techs.map((t) => {
                  const k = kpis.get(t.id);
                  const open = k?.open_jobs ?? 0;
                  const level = loadLevel(open);
                  return (
                    <StaggerItem
                      key={t.id}
                      className={cn(
                        "bg-card group/card flex flex-col overflow-hidden rounded-xl border shadow-xs transition-shadow hover:shadow-md",
                        !t.active && "opacity-60",
                      )}
                    >
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start gap-3">
                          <span className="bg-primary/10 text-primary relative flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
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
                            <p className="text-muted-foreground text-xs tabular">{t.phone}</p>
                          </div>
                          {t.active ? (
                            <a
                              href={telLink(t.phone)}
                              aria-label={`Call ${t.name}`}
                              className="text-muted-foreground hover:text-primary hover:bg-primary/8 hover:border-primary/30 -mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors sm:size-9"
                            >
                              <Phone className="size-4" />
                            </a>
                          ) : (
                            <span className="bg-muted shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">Inactive</span>
                          )}
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

                        <div className="bg-muted/40 mt-4 space-y-2 rounded-lg border px-3 py-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className={cn("inline-flex items-center gap-1.5 font-medium", t.active ? LOAD_META[level].text : "text-muted-foreground")}>
                              <span className={cn("size-1.5 rounded-full", t.active ? LOAD_META[level].dot : "bg-muted-foreground/40")} />
                              {t.active ? LOAD_META[level].label : "Not dispatchable"}
                            </span>
                            <span className="text-muted-foreground tabular">
                              {open} / {LOAD_CAPACITY} open
                            </span>
                          </div>
                          <LoadMeter openJobs={open} />
                        </div>

                        <dl className="mt-4 grid grid-cols-3 gap-2">
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
                                <span className="text-muted-foreground font-normal">—</span>
                              )
                            }
                          />
                        </dl>
                      </div>

                      <Link
                        href={`/admin/orders?tech=${t.id}`}
                        className="text-primary hover:bg-primary/5 flex h-11 items-center justify-between border-t px-4 text-sm font-medium transition-colors sm:h-10 sm:text-xs"
                      >
                        View assigned jobs
                        <ArrowRight className="size-4 transition-transform group-hover/card:translate-x-0.5 sm:size-3.5" />
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

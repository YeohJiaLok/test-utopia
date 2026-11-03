-- =============================================================================
-- Analytics: KPI aggregation functions (security invoker → RLS still applies).
-- Shared by the KPI dashboard and the AI agent's read-only tools.
-- "Completed" means a completion exists and the order is job_done/reviewed/closed.
-- All day bucketing is Asia/Kuala_Lumpur.
-- =============================================================================

create or replace function public.kpi_technician_summary(p_from timestamptz, p_to timestamptz)
returns table (
  technician_id uuid,
  technician_name text,
  branch_name text,
  team_code text,
  jobs_completed bigint,
  total_amount numeric,
  extra_charges numeric,
  avg_ticket numeric,
  reschedules bigint,
  open_jobs bigint,
  avg_hours_to_complete numeric,
  avg_rating numeric
)
language sql stable
as $$
  select
    t.id, t.name, b.name, t.team_code,
    coalesce(c.jobs, 0),
    coalesce(c.total, 0),
    coalesce(c.extra, 0),
    case when coalesce(c.jobs, 0) > 0 then round(c.total / c.jobs, 2) else 0 end,
    coalesce(r.cnt, 0),
    coalesce(o.open_cnt, 0),
    c.avg_hours,
    rv.avg_rating
  from public.technicians t
  join public.branches b on b.id = t.branch_id
  left join lateral (
    select count(*) as jobs,
           sum(jc.final_amount) as total,
           sum(jc.extra_charges) as extra,
           round((avg(extract(epoch from (jc.completed_at - coalesce(ord.assigned_at, ord.created_at)))) / 3600)::numeric, 1) as avg_hours
    from public.job_completions jc
    join public.orders ord on ord.id = jc.order_id
    where jc.technician_id = t.id
      and ord.status in ('job_done', 'reviewed', 'closed')
      and jc.completed_at >= p_from and jc.completed_at < p_to
  ) c on true
  left join lateral (
    select count(*) as cnt from public.reschedules rs
    where rs.technician_id = t.id and rs.created_at >= p_from and rs.created_at < p_to
  ) r on true
  left join lateral (
    select count(*) as open_cnt from public.orders o2
    where o2.assigned_technician_id = t.id and o2.status in ('assigned', 'in_progress')
  ) o on true
  left join lateral (
    select round(avg(rv.rating)::numeric, 2) as avg_rating
    from public.reviews rv
    join public.job_completions jc2 on jc2.order_id = rv.order_id
    where jc2.technician_id = t.id and jc2.completed_at >= p_from and jc2.completed_at < p_to
  ) rv on true
  where t.active
  order by 5 desc, 6 desc, 2;
$$;

create or replace function public.kpi_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, jobs_created bigint, jobs_completed bigint, revenue numeric)
language sql stable
as $$
  with days as (
    select generate_series(
      (p_from at time zone 'Asia/Kuala_Lumpur')::date,
      ((p_to - interval '1 second') at time zone 'Asia/Kuala_Lumpur')::date,
      interval '1 day'
    )::date as d
  ),
  created as (
    select (o.created_at at time zone 'Asia/Kuala_Lumpur')::date as d, count(*) as n
    from public.orders o
    where o.created_at >= p_from and o.created_at < p_to
    group by 1
  ),
  completed as (
    select (jc.completed_at at time zone 'Asia/Kuala_Lumpur')::date as d,
           count(*) as n, sum(jc.final_amount) as amt
    from public.job_completions jc
    join public.orders o on o.id = jc.order_id
    where o.status in ('job_done', 'reviewed', 'closed')
      and jc.completed_at >= p_from and jc.completed_at < p_to
    group by 1
  )
  select days.d, coalesce(created.n, 0), coalesce(completed.n, 0), coalesce(completed.amt, 0)
  from days
  left join created on created.d = days.d
  left join completed on completed.d = days.d
  order by days.d;
$$;

create or replace function public.kpi_service_mix(p_from timestamptz, p_to timestamptz)
returns table (service_code text, service_name text, jobs bigint, revenue numeric)
language sql stable
as $$
  select st.code, st.name, count(jc.order_id), coalesce(sum(jc.final_amount), 0)
  from public.service_types st
  left join public.orders o on o.service_type_id = st.id and o.status in ('job_done', 'reviewed', 'closed')
  left join public.job_completions jc on jc.order_id = o.id
       and jc.completed_at >= p_from and jc.completed_at < p_to
  group by st.code, st.name
  order by 3 desc;
$$;

create or replace function public.kpi_branch_summary(p_from timestamptz, p_to timestamptz)
returns table (branch_code text, branch_name text, jobs_completed bigint, revenue numeric, open_jobs bigint, technicians bigint)
language sql stable
as $$
  select b.code, b.name,
    (select count(*) from public.job_completions jc
       join public.orders o on o.id = jc.order_id
      where o.branch_id = b.id and o.status in ('job_done', 'reviewed', 'closed')
        and jc.completed_at >= p_from and jc.completed_at < p_to),
    (select coalesce(sum(jc.final_amount), 0) from public.job_completions jc
       join public.orders o on o.id = jc.order_id
      where o.branch_id = b.id and o.status in ('job_done', 'reviewed', 'closed')
        and jc.completed_at >= p_from and jc.completed_at < p_to),
    (select count(*) from public.orders o
      where o.branch_id = b.id and o.status in ('new', 'assigned', 'in_progress')),
    (select count(*) from public.technicians t where t.branch_id = b.id and t.active)
  from public.branches b
  order by 3 desc;
$$;

create or replace function public.kpi_status_counts()
returns table (status public.order_status, total bigint)
language sql stable
as $$
  select s.status, count(o.id)
  from unnest(enum_range(null::public.order_status)) as s(status)
  left join public.orders o on o.status = s.status
  group by s.status
  order by array_position(enum_range(null::public.order_status), s.status);
$$;

-- Workload / overload detection: per-technician z-score vs team mean.
create or replace function public.workload_stats(p_from timestamptz, p_to timestamptz)
returns table (
  technician_id uuid,
  technician_name text,
  branch_name text,
  jobs_completed bigint,
  open_jobs bigint,
  reschedules bigint,
  team_mean numeric,
  team_stddev numeric,
  z_score numeric
)
language sql stable
as $$
  with s as (select * from public.kpi_technician_summary(p_from, p_to)),
  agg as (
    select avg(jobs_completed)::numeric as mean,
           coalesce(stddev_pop(jobs_completed), 0)::numeric as sd
    from s
  )
  select s.technician_id, s.technician_name, s.branch_name, s.jobs_completed, s.open_jobs, s.reschedules,
         round(agg.mean, 2), round(agg.sd, 2),
         case when agg.sd > 0 then round((s.jobs_completed - agg.mean) / agg.sd, 2) else 0 end
  from s cross join agg
  order by 9 desc;
$$;

grant execute on function public.kpi_technician_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_daily(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_service_mix(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_branch_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_status_counts() to authenticated;
grant execute on function public.workload_stats(timestamptz, timestamptz) to authenticated;

-- =============================================================================
-- Rework lifecycle
--  * review_job(…, 'rework') moves Job Done → Rework (was: back to In Progress), counts it
--    in orders.rework_count and logs 'rework_requested' with the manager's note.
--  * The technician is alerted at once: in-app (bell) + WhatsApp deep link with the note.
--  * complete_job accepts In Progress or Rework (resubmission); uploads are allowed in both.
--  * A resubmission alerts managers as "resubmitted after rework" and does NOT send the
--    customer a second "job completed, please leave feedback" WhatsApp.
--  * Open-work counts (KPIs, branch summary) include Rework.
-- =============================================================================

-- --------------------------------------------------------------- review ------
create or replace function public.review_job(
  p_order_id uuid,
  p_decision text,
  p_rating smallint default null,
  p_notes text default null
)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_to public.order_status;
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if public.current_app_role() is distinct from 'manager' then
    raise exception 'Only managers can review jobs' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rework') then
    raise exception 'Decision must be approved or rework' using errcode = '22023';
  end if;
  if p_decision = 'rework' and length(coalesce(v_notes, '')) < 5 then
    raise exception 'Tell the technician what needs to be redone' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status is distinct from 'job_done' then
    raise exception 'Only Job Done orders can be reviewed (currently %)', v_order.status using errcode = 'P0001';
  end if;

  insert into public.reviews (order_id, manager_id, rating, decision, notes)
  values (p_order_id, auth.uid(), p_rating, p_decision, v_notes)
  on conflict (order_id) do update set
    manager_id = excluded.manager_id, rating = excluded.rating,
    decision = excluded.decision, notes = excluded.notes, created_at = now();

  v_to := case when p_decision = 'approved' then 'reviewed' else 'rework' end;

  perform public._enable_workflow();
  update public.orders
  set status = v_to,
      reviewed_at = case when v_to = 'reviewed' then now() else reviewed_at end,
      rework_count = rework_count + case when v_to = 'rework' then 1 else 0 end
  where id = p_order_id
  returning * into v_order;

  perform public._log_event(p_order_id,
    case when p_decision = 'approved' then 'job_reviewed' else 'rework_requested' end,
    'job_done', v_to,
    jsonb_build_object('rating', p_rating, 'notes', v_notes, 'round', v_order.rework_count));

  return v_order;
end $$;

-- ------------------------------------------------------------- complete ------
create or replace function public.complete_job(
  p_order_id uuid,
  p_work_done text,
  p_extra_charges numeric default 0,
  p_remarks text default null,
  p_payment_amount numeric default null,
  p_payment_method public.payment_method default null,
  p_receipt_path text default null
)
returns public.job_completions
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_completion public.job_completions;
  v_from public.order_status;
  v_attachments int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if public.current_app_role() is distinct from 'technician'
     or v_order.assigned_technician_id is distinct from public.current_technician_id() then
    raise exception 'Only the assigned technician can complete this job' using errcode = '42501';
  end if;
  -- Assigned → In Progress → Job Done (start on site first); Rework → Job Done (resubmission).
  if v_order.status is null or v_order.status not in ('in_progress', 'rework') then
    raise exception 'Start the job before completing it (currently %)', v_order.status using errcode = 'P0001';
  end if;
  if coalesce(trim(p_work_done), '') = '' then
    raise exception 'Work done is required' using errcode = '22023';
  end if;
  if coalesce(p_extra_charges, 0) < 0 then
    raise exception 'Extra charges cannot be negative' using errcode = '22023';
  end if;

  v_from := v_order.status;

  insert into public.job_completions (
    order_id, technician_id, work_done, quoted_price, extra_charges, remarks,
    payment_amount, payment_method, receipt_path, completed_at
  ) values (
    p_order_id, v_order.assigned_technician_id, trim(p_work_done), v_order.quoted_price,
    coalesce(p_extra_charges, 0), nullif(trim(coalesce(p_remarks, '')), ''),
    p_payment_amount, p_payment_method, p_receipt_path, now()
  )
  on conflict (order_id) do update set
    work_done = excluded.work_done,
    quoted_price = excluded.quoted_price,
    extra_charges = excluded.extra_charges,
    remarks = excluded.remarks,
    payment_amount = excluded.payment_amount,
    payment_method = excluded.payment_method,
    receipt_path = excluded.receipt_path,
    completed_at = excluded.completed_at
  returning * into v_completion;

  perform public._enable_workflow();
  update public.orders
  set status = 'job_done', completed_at = now(), started_at = coalesce(started_at, now())
  where id = p_order_id;

  select count(*) into v_attachments from public.order_attachments
  where order_id = p_order_id and kind <> 'receipt';

  perform public._log_event(p_order_id,
    case when v_from = 'rework' then 'job_resubmitted' else 'job_completed' end,
    v_from, 'job_done',
    jsonb_build_object(
      'final_amount', v_completion.final_amount,
      'extra_charges', v_completion.extra_charges,
      'attachments', v_attachments,
      'payment_amount', p_payment_amount,
      'payment_method', p_payment_method));

  return v_completion;
end $$;

-- ------------------------------------------------- uploads during rework ------
drop policy "attachments insert" on public.order_attachments;
create policy "attachments insert" on public.order_attachments for insert to authenticated
  with check (
    (select public.current_app_role()) = 'admin'
    or ((select public.current_app_role()) = 'technician'
        and exists (select 1 from public.orders o
                    where o.id = order_id
                      and o.assigned_technician_id = (select public.current_technician_id())
                      and o.status in ('in_progress', 'rework')))
  );

drop policy "attachments delete own" on public.order_attachments;
create policy "attachments delete own" on public.order_attachments for delete to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    or (uploaded_by = (select auth.uid())
        and exists (select 1 from public.orders o
                    where o.id = order_id and o.status in ('in_progress', 'rework')))
  );

drop policy "job media upload" on storage.objects;
create policy "job media upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-media'
    and (
      (select public.current_app_role()) = 'admin'
      or exists (select 1 from public.orders o
                 where o.id = public.try_uuid(split_part(name, '/', 1))
                   and o.assigned_technician_id = (select public.current_technician_id())
                   and o.status in ('in_progress', 'rework'))
    )
  );

-- ------------------------------------------------ notify: sent for rework ------
create or replace function public.notify_on_rework()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tech public.technicians;
  v_note text;
  v_by text;
  v_msg text;
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if not (new.status = 'rework' and old.status is distinct from 'rework') then return new; end if;

  select * into v_tech from public.technicians where id = new.assigned_technician_id;
  if not found then return new; end if;
  select rv.notes, p.full_name into v_note, v_by
  from public.reviews rv left join public.profiles p on p.id = rv.manager_id
  where rv.order_id = new.id;

  v_msg := format(
    E'Hi %s, job %s (%s) was sent back for rework by %s.\n\nTo fix: %s\n\nPlease fix it and resubmit in Sejuk Ops.',
    v_tech.name, new.order_no, new.customer_name, coalesce(v_by, 'the manager'),
    coalesce(v_note, 'See the manager''s note in the app.'));

  insert into public.notifications (order_id, channel, audience, recipient_profile_id, recipient_phone, template, title, message, deep_link)
  values (new.id, 'whatsapp', 'technician', v_tech.profile_id, v_tech.phone, 'job_rework_technician',
          format('Rework %s', new.order_no), v_msg,
          'https://wa.me/' || public.wa_phone(v_tech.phone) || '?text=' || public.url_encode(v_msg));

  if v_tech.profile_id is not null then
    insert into public.notifications (order_id, channel, audience, recipient_profile_id, template, title, message)
    values (new.id, 'in_app', 'technician', v_tech.profile_id, 'job_rework_in_app',
            format('Job %s sent back for rework', new.order_no),
            format('To fix: %s', coalesce(v_note, 'see the manager''s note')));
  end if;

  return new;
end $$;

create trigger orders_notify_rework
  after update of status on public.orders
  for each row execute function public.notify_on_rework();

-- ------------------------------------- notify: job done / resubmitted ------
create or replace function public.notify_on_job_done()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tech public.technicians;
  v_final numeric;
  v_service text;
  v_msg text;
  v_recipient record;
  v_resubmit boolean;
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if not (new.status = 'job_done' and old.status is distinct from 'job_done') then
    return new;
  end if;
  v_resubmit := old.status = 'rework';

  select * into v_tech from public.technicians where id = new.assigned_technician_id;
  select final_amount into v_final from public.job_completions where order_id = new.id;
  select name into v_service from public.service_types where id = new.service_type_id;

  -- The customer is asked for feedback once, on the first completion only.
  if not v_resubmit then
    v_msg := format(
      E'Hi %s,\nJob %s has been completed by Technician %s at %s.\nPlease check and leave feedback.\nThank you!',
      new.customer_name, new.order_no, coalesce(v_tech.name, '-'),
      public.myt_label(coalesce(new.completed_at, now())));

    insert into public.notifications (order_id, channel, audience, recipient_phone, template, title, message, deep_link)
    values (new.id, 'whatsapp', 'customer', new.customer_phone, 'job_done_customer_feedback',
            format('Feedback request · %s', new.customer_name), v_msg,
            'https://wa.me/' || public.wa_phone(new.customer_phone) || '?text=' || public.url_encode(v_msg));
  end if;

  for v_recipient in select id, role from public.profiles where role in ('manager', 'admin') and active loop
    insert into public.notifications (order_id, channel, audience, recipient_profile_id, template, title, message)
    values (new.id, 'in_app',
            case when v_recipient.role = 'manager' then 'manager' else 'accounts' end::public.notification_audience,
            v_recipient.id, 'job_done_review',
            case when v_resubmit then format('Job %s resubmitted after rework', new.order_no)
                 else format('Job %s completed', new.order_no) end,
            format('%s %s %s for %s · Final RM %s',
                   coalesce(v_tech.name, 'Technician'),
                   case when v_resubmit then 'fixed and resubmitted' else 'completed' end,
                   v_service, new.customer_name,
                   to_char(coalesce(v_final, new.quoted_price), 'FM999,990.00')));
  end loop;

  return new;
end $$;

-- ------------------------------------------------- existing sent-back jobs ------
-- Jobs already sent back under the old rule (back to In Progress) move to Rework.
-- Recorded in the audit trail as a system status correction.
do $$
declare
  r record;
begin
  perform public._enable_workflow();
  for r in
    select o.id from public.orders o
    join public.reviews rv on rv.order_id = o.id and rv.decision = 'rework'
    where o.status = 'in_progress'
  loop
    update public.orders set status = 'rework' where id = r.id;
    perform public._log_event(r.id, 'status_migrated', 'in_progress', 'rework',
      jsonb_build_object('reason', 'Rework became its own status'));
  end loop;

  update public.orders o set rework_count = e.n
  from (select order_id, count(*)::int as n from public.order_events
        where action = 'rework_requested' group by order_id) e
  where e.order_id = o.id and o.rework_count is distinct from e.n;
end $$;

-- ------------------------------------- open work includes Rework (KPIs) ------
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
    where o2.assigned_technician_id = t.id and o2.status in ('assigned', 'in_progress', 'rework')
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
      where o.branch_id = b.id and o.status in ('new', 'assigned', 'in_progress', 'rework')),
    (select count(*) from public.technicians t where t.branch_id = b.id and t.active)
  from public.branches b
  order by 3 desc;
$$;

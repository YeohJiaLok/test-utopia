-- =============================================================================
-- Workflow engine
--  * Every status change goes through a SECURITY DEFINER function that checks
--    the caller's role, validates the transition and appends to order_events.
--  * A guard trigger rejects status / assignment changes made any other way.
--  * Notification triggers implement Module 3 (WhatsApp on Job Done) and the
--    Module 1 bonus (WhatsApp to technician on assignment).
-- =============================================================================

-- ------------------------------------------------------------- helpers ------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_technician_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.technicians where profile_id = auth.uid() $$;

create or replace function public.can_access_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select case public.current_app_role()
    when 'admin' then true
    when 'manager' then true
    when 'technician' then exists (
      select 1 from public.orders o
      where o.id = p_order_id and o.assigned_technician_id = public.current_technician_id()
    )
    else false
  end
$$;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Malaysian numbers → WhatsApp international format (012-345 6789 → 60123456789)
create or replace function public.wa_phone(p text)
returns text
language sql immutable
as $$
  select case
    when d like '60%' then d
    when d like '0%' then '6' || d
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

create or replace function public.url_encode(p text)
returns text
language plpgsql immutable
as $$
declare
  result text := '';
  ch text;
  b bytea;
  i int;
begin
  if p is null then return ''; end if;
  for ch in select regexp_split_to_table(p, '') loop
    if ch ~ '^[A-Za-z0-9_.~-]$' then
      result := result || ch;
    else
      b := convert_to(ch, 'UTF8');
      for i in 0 .. length(b) - 1 loop
        result := result || '%' || upper(lpad(to_hex(get_byte(b, i)), 2, '0'));
      end loop;
    end if;
  end loop;
  return result;
end $$;

create or replace function public.myt_label(p timestamptz)
returns text
language sql immutable
as $$ select to_char(p at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY, HH12:MI AM') $$;

create or replace function public._log_event(
  p_order_id uuid,
  p_action text,
  p_from public.order_status,
  p_to public.order_status,
  p_payload jsonb default '{}'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_role public.app_role;
begin
  select full_name, role into v_name, v_role from public.profiles where id = auth.uid();
  insert into public.order_events (order_id, actor_id, actor_name, actor_role, action, from_status, to_status, payload)
  values (p_order_id, auth.uid(), coalesce(v_name, 'System'), v_role, p_action, p_from, p_to, coalesce(p_payload, '{}'));
end $$;

create or replace function public._enable_workflow()
returns void
language sql
as $$ select set_config('app.workflow', 'on', true); $$;

-- ------------------------------------------------------- guard trigger ------
create or replace function public.guard_order_update()
returns trigger
language plpgsql
as $$
begin
  if (new.status is distinct from old.status
      or new.assigned_technician_id is distinct from old.assigned_technician_id)
     and coalesce(current_setting('app.workflow', true), '') <> 'on'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Order status and assignment can only change through workflow actions'
      using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger orders_guard_update
  before update on public.orders
  for each row execute function public.guard_order_update();

-- --------------------------------------------------- attachment limit ------
create or replace function public.enforce_attachment_limit()
returns trigger
language plpgsql
as $$
begin
  if new.kind <> 'receipt' and (
    select count(*) from public.order_attachments
    where order_id = new.order_id and kind <> 'receipt'
  ) >= 6 then
    raise exception 'A job can have at most 6 photos / videos / PDFs' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger order_attachments_limit
  before insert on public.order_attachments
  for each row execute function public.enforce_attachment_limit();

-- ======================================================= workflow RPCs ======

-- Module 1: Admin creates an order (optionally assigning a technician).
create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_service_type_id smallint,
  p_problem_description text,
  p_quoted_price numeric,
  p_assigned_technician_id uuid default null,
  p_admin_notes text default null,
  p_scheduled_at timestamptz default null,
  p_branch_id smallint default null,
  p_source text default 'manual'
)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_customer uuid;
  v_branch smallint;
  v_tech public.technicians;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only admins can create orders' using errcode = '42501';
  end if;
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_customer_phone), '') = ''
     or coalesce(trim(p_customer_address), '') = '' or coalesce(trim(p_problem_description), '') = '' then
    raise exception 'Customer name, phone, address and problem description are required' using errcode = '22023';
  end if;
  if p_quoted_price is null or p_quoted_price < 0 then
    raise exception 'Quoted price must be zero or more' using errcode = '22023';
  end if;

  if p_assigned_technician_id is not null then
    select * into v_tech from public.technicians where id = p_assigned_technician_id and active;
    if not found then
      raise exception 'Technician not found or inactive' using errcode = '22023';
    end if;
  end if;

  select id into v_customer from public.customers
  where public.wa_phone(phone) = public.wa_phone(p_customer_phone)
  order by created_at desc limit 1;

  v_branch := coalesce(p_branch_id, v_tech.branch_id,
                       (select branch_id from public.profiles where id = auth.uid()));

  if v_customer is null then
    insert into public.customers (name, phone, address, branch_id)
    values (trim(p_customer_name), trim(p_customer_phone), trim(p_customer_address), v_branch)
    returning id into v_customer;
  end if;

  perform public._enable_workflow();

  insert into public.orders (
    customer_id, customer_name, customer_phone, customer_address, branch_id, service_type_id,
    problem_description, quoted_price, assigned_technician_id, admin_notes, status,
    scheduled_at, source, created_by, assigned_at
  ) values (
    v_customer, trim(p_customer_name), trim(p_customer_phone), trim(p_customer_address), v_branch,
    p_service_type_id, trim(p_problem_description), p_quoted_price, p_assigned_technician_id,
    nullif(trim(coalesce(p_admin_notes, '')), ''),
    case when p_assigned_technician_id is null then 'new' else 'assigned' end::public.order_status,
    p_scheduled_at, coalesce(p_source, 'manual'), auth.uid(),
    case when p_assigned_technician_id is null then null else now() end
  ) returning * into v_order;

  perform public._log_event(v_order.id, 'order_created', null, 'new',
    jsonb_build_object('quoted_price', p_quoted_price, 'source', coalesce(p_source, 'manual')));

  if p_assigned_technician_id is not null then
    perform public._log_event(v_order.id, 'technician_assigned', 'new', 'assigned',
      jsonb_build_object('technician_id', v_tech.id, 'technician_name', v_tech.name));
  end if;

  return v_order;
end $$;

-- Only Admin can assign / reassign technicians.
create or replace function public.assign_technician(p_order_id uuid, p_technician_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_tech public.technicians;
  v_prev uuid;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only admins can assign technicians' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status not in ('new', 'assigned') then
    raise exception 'Cannot reassign an order that is %', v_order.status using errcode = 'P0001';
  end if;

  select * into v_tech from public.technicians where id = p_technician_id and active;
  if not found then raise exception 'Technician not found or inactive' using errcode = '22023'; end if;

  v_prev := v_order.assigned_technician_id;
  perform public._enable_workflow();

  update public.orders
  set assigned_technician_id = p_technician_id,
      status = 'assigned',
      assigned_at = now(),
      branch_id = coalesce(branch_id, v_tech.branch_id)
  where id = p_order_id
  returning * into v_order;

  perform public._log_event(p_order_id,
    case when v_prev is null then 'technician_assigned' else 'technician_reassigned' end,
    case when v_prev is null then 'new' else 'assigned' end::public.order_status, 'assigned',
    jsonb_build_object('technician_id', v_tech.id, 'technician_name', v_tech.name, 'previous_technician_id', v_prev));

  return v_order;
end $$;

-- Technician starts the job on site.
create or replace function public.start_job(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if not (public.current_app_role() = 'admin'
          or (public.current_app_role() = 'technician'
              and v_order.assigned_technician_id = public.current_technician_id())) then
    raise exception 'Only the assigned technician can start this job' using errcode = '42501';
  end if;
  if v_order.status <> 'assigned' then
    raise exception 'Job must be Assigned to start (currently %)', v_order.status using errcode = 'P0001';
  end if;

  perform public._enable_workflow();
  update public.orders set status = 'in_progress', started_at = now()
  where id = p_order_id returning * into v_order;

  perform public._log_event(p_order_id, 'job_started', 'assigned', 'in_progress', '{}');
  return v_order;
end $$;

-- Module 2: only the assigned technician can complete the job.
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
  if v_order.status not in ('assigned', 'in_progress') then
    raise exception 'Job cannot be completed from status %', v_order.status using errcode = 'P0001';
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

  perform public._log_event(p_order_id, 'job_completed', v_from, 'job_done',
    jsonb_build_object(
      'final_amount', v_completion.final_amount,
      'extra_charges', v_completion.extra_charges,
      'attachments', v_attachments,
      'payment_amount', p_payment_amount,
      'payment_method', p_payment_method));

  return v_completion;
end $$;

-- Manager reviews a completed job: approve → Reviewed, or send back for rework.
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
begin
  if public.current_app_role() is distinct from 'manager' then
    raise exception 'Only managers can review jobs' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rework') then
    raise exception 'Decision must be approved or rework' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status <> 'job_done' then
    raise exception 'Only Job Done orders can be reviewed (currently %)', v_order.status using errcode = 'P0001';
  end if;

  insert into public.reviews (order_id, manager_id, rating, decision, notes)
  values (p_order_id, auth.uid(), p_rating, p_decision, nullif(trim(coalesce(p_notes, '')), ''))
  on conflict (order_id) do update set
    manager_id = excluded.manager_id, rating = excluded.rating,
    decision = excluded.decision, notes = excluded.notes, created_at = now();

  v_to := case when p_decision = 'approved' then 'reviewed' else 'in_progress' end;

  perform public._enable_workflow();
  update public.orders
  set status = v_to,
      reviewed_at = case when v_to = 'reviewed' then now() else reviewed_at end
  where id = p_order_id
  returning * into v_order;

  perform public._log_event(p_order_id,
    case when p_decision = 'approved' then 'job_reviewed' else 'rework_requested' end,
    'job_done', v_to,
    jsonb_build_object('rating', p_rating, 'notes', p_notes));

  return v_order;
end $$;

create or replace function public.close_job(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if public.current_app_role() not in ('manager', 'admin') then
    raise exception 'Only managers or admins can close jobs' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status <> 'reviewed' then
    raise exception 'Only Reviewed orders can be closed (currently %)', v_order.status using errcode = 'P0001';
  end if;

  perform public._enable_workflow();
  update public.orders set status = 'closed', closed_at = now()
  where id = p_order_id returning * into v_order;

  perform public._log_event(p_order_id, 'job_closed', 'reviewed', 'closed', '{}');
  return v_order;
end $$;

-- Postpone / reschedule (feeds the KPI "Postpone / Reschedule" metric).
create or replace function public.reschedule_order(
  p_order_id uuid,
  p_new_scheduled_at timestamptz,
  p_reason text
)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_old timestamptz;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if not (public.current_app_role() = 'admin'
          or (public.current_app_role() = 'technician'
              and v_order.assigned_technician_id = public.current_technician_id())) then
    raise exception 'Only admins or the assigned technician can reschedule' using errcode = '42501';
  end if;
  if v_order.status not in ('new', 'assigned', 'in_progress') then
    raise exception 'Cannot reschedule an order that is %', v_order.status using errcode = 'P0001';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  v_old := v_order.scheduled_at;

  insert into public.reschedules (order_id, technician_id, old_scheduled_at, new_scheduled_at, reason, requested_by)
  values (p_order_id, v_order.assigned_technician_id, v_old, p_new_scheduled_at, trim(p_reason), auth.uid());

  update public.orders
  set scheduled_at = p_new_scheduled_at, reschedule_count = reschedule_count + 1
  where id = p_order_id returning * into v_order;

  perform public._log_event(p_order_id, 'job_rescheduled', v_order.status, v_order.status,
    jsonb_build_object('from', v_old, 'to', p_new_scheduled_at, 'reason', p_reason));

  return v_order;
end $$;

-- =============================================== notification triggers ======

-- Module 1 bonus: WhatsApp the technician when a job is assigned to them.
create or replace function public.notify_on_assignment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tech public.technicians;
  v_service text;
  v_msg text;
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;   -- bulk seed / system jobs
  if new.assigned_technician_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_technician_id is not distinct from old.assigned_technician_id then
    return new;
  end if;

  select * into v_tech from public.technicians where id = new.assigned_technician_id;
  select name into v_service from public.service_types where id = new.service_type_id;

  v_msg := format(
    E'Hi %s, new job assigned to you.\n\nOrder: %s\nService: %s\nCustomer: %s (%s)\nAddress: %s\nSchedule: %s\nProblem: %s\n\nPlease open Sejuk Ops for details.',
    v_tech.name, new.order_no, v_service, new.customer_name, new.customer_phone, new.customer_address,
    coalesce(public.myt_label(new.scheduled_at), 'To be confirmed'), new.problem_description);

  insert into public.notifications (order_id, channel, audience, recipient_profile_id, recipient_phone, template, title, message, deep_link)
  values (new.id, 'whatsapp', 'technician', v_tech.profile_id, v_tech.phone, 'job_assigned_technician',
          format('New job %s', new.order_no), v_msg,
          'https://wa.me/' || public.wa_phone(v_tech.phone) || '?text=' || public.url_encode(v_msg));

  if v_tech.profile_id is not null then
    insert into public.notifications (order_id, channel, audience, recipient_profile_id, template, title, message)
    values (new.id, 'in_app', 'technician', v_tech.profile_id, 'job_assigned_in_app',
            format('New job %s assigned', new.order_no),
            format('%s for %s · %s', v_service, new.customer_name, new.customer_address));
  end if;

  return new;
end $$;

create trigger orders_notify_assignment
  after insert or update of assigned_technician_id on public.orders
  for each row execute function public.notify_on_assignment();

-- Module 3: status = Job Done → WhatsApp feedback request to customer
-- + in-app notification to managers / accounts.
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
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if not (new.status = 'job_done' and old.status is distinct from 'job_done') then
    return new;
  end if;

  select * into v_tech from public.technicians where id = new.assigned_technician_id;
  select final_amount into v_final from public.job_completions where order_id = new.id;
  select name into v_service from public.service_types where id = new.service_type_id;

  v_msg := format(
    E'Hi %s,\nJob %s has been completed by Technician %s at %s.\nPlease check and leave feedback.\nThank you!',
    new.customer_name, new.order_no, coalesce(v_tech.name, '-'),
    public.myt_label(coalesce(new.completed_at, now())));

  insert into public.notifications (order_id, channel, audience, recipient_phone, template, title, message, deep_link)
  values (new.id, 'whatsapp', 'customer', new.customer_phone, 'job_done_customer_feedback',
          format('Feedback request · %s', new.customer_name), v_msg,
          'https://wa.me/' || public.wa_phone(new.customer_phone) || '?text=' || public.url_encode(v_msg));

  for v_recipient in select id, role from public.profiles where role in ('manager', 'admin') loop
    insert into public.notifications (order_id, channel, audience, recipient_profile_id, template, title, message)
    values (new.id, 'in_app',
            case when v_recipient.role = 'manager' then 'manager' else 'accounts' end::public.notification_audience,
            v_recipient.id, 'job_done_review',
            format('Job %s completed', new.order_no),
            format('%s completed %s for %s · Final RM %s',
                   coalesce(v_tech.name, 'Technician'), v_service, new.customer_name,
                   to_char(coalesce(v_final, new.quoted_price), 'FM999,990.00')));
  end loop;

  return new;
end $$;

create trigger orders_notify_job_done
  after update of status on public.orders
  for each row execute function public.notify_on_job_done();

-- ---------------------------------------------------------- privileges ------
revoke execute on function public._log_event(uuid, text, public.order_status, public.order_status, jsonb) from public, anon, authenticated;
revoke execute on function public._enable_workflow() from public, anon, authenticated;

revoke execute on function public.create_order(text, text, text, smallint, text, numeric, uuid, text, timestamptz, smallint, text) from public, anon;
revoke execute on function public.assign_technician(uuid, uuid) from public, anon;
revoke execute on function public.start_job(uuid) from public, anon;
revoke execute on function public.complete_job(uuid, text, numeric, text, numeric, public.payment_method, text) from public, anon;
revoke execute on function public.review_job(uuid, text, smallint, text) from public, anon;
revoke execute on function public.close_job(uuid) from public, anon;
revoke execute on function public.reschedule_order(uuid, timestamptz, text) from public, anon;

grant execute on function public.create_order(text, text, text, smallint, text, numeric, uuid, text, timestamptz, smallint, text) to authenticated;
grant execute on function public.assign_technician(uuid, uuid) to authenticated;
grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.complete_job(uuid, text, numeric, text, numeric, public.payment_method, text) to authenticated;
grant execute on function public.review_job(uuid, text, smallint, text) to authenticated;
grant execute on function public.close_job(uuid) to authenticated;
grant execute on function public.reschedule_order(uuid, timestamptz, text) to authenticated;

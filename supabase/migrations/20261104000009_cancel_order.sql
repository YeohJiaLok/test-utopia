-- =============================================================================
-- Order cancellation + mandatory technician on create.
-- =============================================================================

-- ------------------------------------------------------------ reasons -----
create or replace function public.cancel_reason_label(p_code text)
returns text
language sql immutable
as $$
  select case p_code
    when 'customer_request' then 'Customer cancelled'
    when 'duplicate' then 'Duplicate order'
    when 'unreachable' then 'Customer unreachable'
    when 'out_of_area' then 'Outside service area'
    when 'other' then 'Other'
  end
$$;

alter table public.orders drop constraint if exists orders_cancel_reason_check;
alter table public.orders add constraint orders_cancel_reason_check
  check (cancel_reason is null or public.cancel_reason_label(cancel_reason) is not null);
alter table public.orders drop constraint if exists orders_cancelled_consistent;
alter table public.orders add constraint orders_cancelled_consistent
  check ((status = 'cancelled') = (cancelled_at is not null and cancel_reason is not null));

-- ------------------------------------------------------- cancel_order -----
-- Admin only; before the work is done (new / assigned / in_progress). A completed job is
-- billed work and goes through manager review instead. Audited in order_events.
create or replace function public.cancel_order(p_order_id uuid, p_reason text, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_tech_name text;
  v_prev public.order_status;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only admins can cancel orders' using errcode = '42501';
  end if;
  if public.cancel_reason_label(p_reason) is null then
    raise exception 'Choose a cancellation reason' using errcode = '22023';
  end if;
  if p_reason = 'other' and v_note is null then
    raise exception 'Describe the reason when choosing Other' using errcode = '22023';
  end if;
  if length(coalesce(v_note, '')) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.status not in ('new', 'assigned', 'in_progress') then
    raise exception 'Cannot cancel an order that is %', v_order.status using errcode = 'P0001';
  end if;

  select name into v_tech_name from public.technicians where id = v_order.assigned_technician_id;
  v_prev := v_order.status;

  perform public._enable_workflow();
  update public.orders
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = p_reason, cancel_note = v_note
   where id = p_order_id
  returning * into v_order;

  perform public._log_event(p_order_id, 'order_cancelled', v_prev, 'cancelled',
    jsonb_build_object('reason', p_reason, 'reason_label', public.cancel_reason_label(p_reason),
                       'note', v_note, 'technician_name', v_tech_name));
  return v_order;
end $$;

revoke execute on function public.cancel_order(uuid, text, text) from public, anon;
grant execute on function public.cancel_order(uuid, text, text) to authenticated;

-- --------------------------------------------- cancellation notifications --
-- The assigned technician (WhatsApp + in-app: don't go) and the customer (WhatsApp
-- confirmation) are told automatically; the messages land in the WhatsApp outbox.
create or replace function public.notify_on_cancel()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tech public.technicians;
  v_service text;
  v_reason text := public.cancel_reason_label(new.cancel_reason);
  v_msg text;
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;   -- bulk seed / system jobs
  if not (new.status = 'cancelled' and old.status is distinct from 'cancelled') then return new; end if;

  select name into v_service from public.service_types where id = new.service_type_id;

  if new.assigned_technician_id is not null then
    select * into v_tech from public.technicians where id = new.assigned_technician_id;
    v_msg := format(
      E'Hi %s, job %s has been CANCELLED. Please do not go to site.\n\nService: %s\nCustomer: %s\nAddress: %s\nWas scheduled: %s\nReason: %s\n\nSejuk Ops',
      v_tech.name, new.order_no, v_service, new.customer_name, new.customer_address,
      coalesce(public.myt_label(new.scheduled_at), 'Not scheduled'), v_reason);
    insert into public.notifications (order_id, channel, audience, recipient_profile_id, recipient_phone, template, title, message, deep_link)
    values (new.id, 'whatsapp', 'technician', v_tech.profile_id, v_tech.phone, 'job_cancelled_technician',
            format('Job %s cancelled', new.order_no), v_msg,
            'https://wa.me/' || public.wa_phone(v_tech.phone) || '?text=' || public.url_encode(v_msg));
    if v_tech.profile_id is not null then
      insert into public.notifications (order_id, channel, audience, recipient_profile_id, template, title, message)
      values (new.id, 'in_app', 'technician', v_tech.profile_id, 'job_cancelled_in_app',
              format('Job %s cancelled', new.order_no),
              format('%s for %s · %s. Do not go to site.', v_service, new.customer_name, v_reason));
    end if;
  end if;

  v_msg := format(
    E'Hi %s,\nYour Sejuk Sejuk service order %s (%s) has been cancelled.\nReason: %s\nTo book again, simply reply to this message.\nThank you!',
    new.customer_name, new.order_no, v_service, v_reason);
  insert into public.notifications (order_id, channel, audience, recipient_phone, template, title, message, deep_link)
  values (new.id, 'whatsapp', 'customer', new.customer_phone, 'order_cancelled_customer',
          format('Cancellation notice · %s', new.customer_name), v_msg,
          'https://wa.me/' || public.wa_phone(new.customer_phone) || '?text=' || public.url_encode(v_msg));

  return new;
end $$;

drop trigger if exists orders_notify_cancel on public.orders;
create trigger orders_notify_cancel
  after update of status on public.orders
  for each row execute function public.notify_on_cancel();

-- ---------------------------------------- create_order: technician required --
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
  -- Every order is dispatched when it is created.
  if p_assigned_technician_id is null then
    raise exception 'Assign a technician to create the order' using errcode = '22023';
  end if;

  select * into v_tech from public.technicians where id = p_assigned_technician_id and active;
  if not found then
    raise exception 'Technician not found or inactive' using errcode = '22023';
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
    'assigned', p_scheduled_at, coalesce(p_source, 'manual'), auth.uid(), now()
  ) returning * into v_order;

  perform public._log_event(v_order.id, 'order_created', null, 'new',
    jsonb_build_object('quoted_price', p_quoted_price, 'source', coalesce(p_source, 'manual')));
  perform public._log_event(v_order.id, 'technician_assigned', 'new', 'assigned',
    jsonb_build_object('technician_id', v_tech.id, 'technician_name', v_tech.name));

  return v_order;
end $$;

-- ------------------------------------------------- search: "canceled" too --
-- (search_orders already indexes the status text, so "cancelled" matches as-is.)

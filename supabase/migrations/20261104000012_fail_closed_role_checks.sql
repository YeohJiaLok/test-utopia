-- =============================================================================
-- Fail-closed role checks in workflow functions.
--
-- `if not (current_app_role() = 'admin' or …) then raise` does NOT raise when the role is
-- NULL (no profile, deactivated account, or a 2FA user whose session hasn't passed the
-- code step): NOT (NULL) is NULL, and IF NULL skips the branch. Found by
-- `npm run security:check` (a password-only session of a 2FA technician could start their
-- job). The checks below are rewritten so that anything other than an explicit TRUE refuses.
-- Bodies are otherwise unchanged from *_workflow.sql. create_order, assign_technician,
-- complete_job, review_job and cancel_order already used NULL-safe `is distinct from`.
-- =============================================================================

create or replace function public.start_job(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  -- NULL-safe: a session without a confirmed role (signed out, deactivated, 2FA code pending)
  -- makes this condition NULL, which must refuse, not fall through.
  if (public.current_app_role() = 'admin'
      or (public.current_app_role() = 'technician'
          and v_order.assigned_technician_id = public.current_technician_id())) is not true then
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

create or replace function public.close_job(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if coalesce(public.current_app_role()::text, '') not in ('manager', 'admin') then
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

  if (public.current_app_role() = 'admin'
      or (public.current_app_role() = 'technician'
          and v_order.assigned_technician_id = public.current_technician_id())) is not true then
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

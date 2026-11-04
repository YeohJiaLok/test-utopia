-- =============================================================================
-- Strict lifecycle: Assigned → In Progress → Job Done.
-- A technician must press "Start job" on site before completing it. complete_job() used to
-- accept Assigned jobs directly; it now requires In Progress. Job photos are taken during
-- the job, so technician uploads (and removing their own uploads) also require In Progress.
-- Admin uploads are unchanged. Function body otherwise identical to *_workflow.sql.
-- =============================================================================

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
  -- Assigned → In Progress → Job Done: the technician must start the job on site first.
  if v_order.status is distinct from 'in_progress' then
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

  perform public._log_event(p_order_id, 'job_completed', v_from, 'job_done',
    jsonb_build_object(
      'final_amount', v_completion.final_amount,
      'extra_charges', v_completion.extra_charges,
      'attachments', v_attachments,
      'payment_amount', p_payment_amount,
      'payment_method', p_payment_method));

  return v_completion;
end $$;

drop policy "attachments insert" on public.order_attachments;
create policy "attachments insert" on public.order_attachments for insert to authenticated
  with check (
    (select public.current_app_role()) = 'admin'
    or ((select public.current_app_role()) = 'technician'
        and exists (select 1 from public.orders o
                    where o.id = order_id
                      and o.assigned_technician_id = (select public.current_technician_id())
                      and o.status = 'in_progress'))
  );

drop policy "attachments delete own" on public.order_attachments;
create policy "attachments delete own" on public.order_attachments for delete to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    or (uploaded_by = (select auth.uid())
        and exists (select 1 from public.orders o
                    where o.id = order_id and o.status = 'in_progress'))
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
                   and o.status = 'in_progress')
    )
  );

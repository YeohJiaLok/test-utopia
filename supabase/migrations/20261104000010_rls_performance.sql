-- =============================================================================
-- RLS performance: same rules, evaluated once per query instead of once per row.
--
-- Policies that call a function directly (current_app_role(), can_access_order(id)) run it
-- for every row scanned; each call looks up the profile, the technician row and the 2FA
-- factors. Wrapping the call in a scalar sub-select, `(select public.current_app_role())`,
-- makes Postgres evaluate it once per statement (an InitPlan) and reuse the result. For a
-- technician, "orders assigned to me" becomes one hashed sub-query instead of a function
-- call per row. Measured before: counting orders as admin 380 ms vs 100 ms without RLS,
-- order_events 1.2 s. Access rules are unchanged (security:check proves it).
-- =============================================================================

-- --------------------------------------------------------------- orders ----
drop policy "orders visible by role" on public.orders;
create policy "orders visible by role" on public.orders for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager')
    or (assigned_technician_id is not null and assigned_technician_id = (select public.current_technician_id()))
  );

-- ---------------------------------------------- tables that follow an order --
drop policy "completions visible" on public.job_completions;
create policy "completions visible" on public.job_completions for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager')
    or order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id()))
  );

drop policy "reviews visible" on public.reviews;
create policy "reviews visible" on public.reviews for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager')
    or order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id()))
  );

drop policy "reschedules visible" on public.reschedules;
create policy "reschedules visible" on public.reschedules for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager')
    or order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id()))
  );

drop policy "events visible" on public.order_events;
create policy "events visible" on public.order_events for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager')
    or order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id()))
  );

drop policy "attachments visible" on public.order_attachments;
create policy "attachments visible" on public.order_attachments for select to authenticated
  using (
    (select public.current_app_role()) in ('admin', 'manager')
    or order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id()))
  );

drop policy "attachments insert" on public.order_attachments;
create policy "attachments insert" on public.order_attachments for insert to authenticated
  with check (
    (select public.current_app_role()) = 'admin'
    or ((select public.current_app_role()) = 'technician'
        and exists (select 1 from public.orders o
                    where o.id = order_id
                      and o.assigned_technician_id = (select public.current_technician_id())
                      and o.status in ('assigned', 'in_progress')))
  );

drop policy "attachments delete own" on public.order_attachments;
create policy "attachments delete own" on public.order_attachments for delete to authenticated
  using (
    (select public.current_app_role()) = 'admin'
    or (uploaded_by = (select auth.uid())
        and exists (select 1 from public.orders o
                    where o.id = order_id and o.status in ('assigned', 'in_progress')))
  );

-- -------------------------------------------------------------- office -----
drop policy "customers office read" on public.customers;
create policy "customers office read" on public.customers for select to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager'));

drop policy "ai flags office read" on public.ai_flags;
create policy "ai flags office read" on public.ai_flags for select to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager'));

drop policy "ai flags manager resolve" on public.ai_flags;
create policy "ai flags manager resolve" on public.ai_flags for update to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager') and not resolved)
  with check (
    (select public.current_app_role()) in ('admin', 'manager')
    and resolved
    and resolved_by = (select auth.uid())
  );

drop policy "ai runs office read" on public.ai_runs;
create policy "ai runs office read" on public.ai_runs for select to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager'));

drop policy "ai insights office read" on public.ai_insights;
create policy "ai insights office read" on public.ai_insights for select to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager'));

drop policy "user admin events office read" on public.user_admin_events;
create policy "user admin events office read" on public.user_admin_events for select to authenticated
  using ((select public.current_app_role()) in ('admin', 'manager'));

-- ---------------------------------------------------------- directory ------
drop policy "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_app_role()) in ('admin', 'manager'));

drop policy "technicians readable" on public.technicians;
create policy "technicians readable" on public.technicians for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.current_app_role()) in ('admin', 'manager'));

-- -------------------------------------------------------- notifications ----
drop policy "notifications visible" on public.notifications;
create policy "notifications visible" on public.notifications for select to authenticated
  using (
    (recipient_profile_id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.current_app_role()) in ('admin', 'manager')
    or (channel = 'whatsapp' and audience = 'customer'
        and order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id())))
  );

drop policy "notifications update own or office" on public.notifications;
create policy "notifications update own or office" on public.notifications for update to authenticated
  using (
    (recipient_profile_id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.current_app_role()) in ('admin', 'manager')
    or (channel = 'whatsapp'
        and order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id())))
  )
  with check (
    (recipient_profile_id = (select auth.uid()) and (select public.current_app_role()) is not null)
    or (select public.current_app_role()) in ('admin', 'manager')
    or (channel = 'whatsapp'
        and order_id in (select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id())))
  );

-- ------------------------------------------------------------- storage -----
drop policy "job media read" on storage.objects;
create policy "job media read" on storage.objects for select to authenticated
  using (
    bucket_id = 'job-media'
    and (
      name like 'samples/%'
      or (select public.current_app_role()) in ('admin', 'manager')
      or public.try_uuid(split_part(name, '/', 1)) in (
        select o.id from public.orders o where o.assigned_technician_id = (select public.current_technician_id()))
    )
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
                   and o.status in ('assigned', 'in_progress'))
    )
  );

-- Supporting index for "orders assigned to me" (technician sub-queries above).
create index if not exists orders_assigned_technician_idx on public.orders (assigned_technician_id, status);

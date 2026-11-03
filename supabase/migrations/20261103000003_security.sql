-- =============================================================================
-- Row Level Security
--  admin       : full operational access
--  manager     : read everything, review/close, resolve AI flags
--  technician  : only orders assigned to them (and their related records)
-- Mutations to orders flow through workflow RPCs (security definer).
-- =============================================================================

alter table public.branches          enable row level security;
alter table public.service_types     enable row level security;
alter table public.profiles          enable row level security;
alter table public.technicians       enable row level security;
alter table public.customers         enable row level security;
alter table public.orders            enable row level security;
alter table public.job_completions   enable row level security;
alter table public.order_attachments enable row level security;
alter table public.order_events      enable row level security;
alter table public.reschedules       enable row level security;
alter table public.reviews           enable row level security;
alter table public.notifications     enable row level security;
alter table public.ai_flags          enable row level security;
alter table public.ai_runs           enable row level security;
alter table public.ai_insights       enable row level security;

-- Reference data: readable by any signed-in user.
create policy "branches readable" on public.branches for select to authenticated using (true);
create policy "service types readable" on public.service_types for select to authenticated using (true);
create policy "technicians readable" on public.technicians for select to authenticated using (true);
create policy "profiles readable" on public.profiles for select to authenticated using (true);

create policy "service types admin write" on public.service_types for all to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- Customers: office staff only.
create policy "customers office read" on public.customers for select to authenticated
  using (public.current_app_role() in ('admin', 'manager'));
create policy "customers admin write" on public.customers for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- Orders
create policy "orders visible by role" on public.orders for select to authenticated
  using (public.can_access_order(id));
-- Admin may edit order details; the guard trigger still blocks status / assignment edits.
create policy "orders admin edit details" on public.orders for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- Job completions / reviews / reschedules / events follow order visibility.
create policy "completions visible" on public.job_completions for select to authenticated
  using (public.can_access_order(order_id));
create policy "reviews visible" on public.reviews for select to authenticated
  using (public.can_access_order(order_id));
create policy "reschedules visible" on public.reschedules for select to authenticated
  using (public.can_access_order(order_id));
create policy "events visible" on public.order_events for select to authenticated
  using (public.can_access_order(order_id));

-- Attachments: assigned technician (or admin) uploads; visibility follows order.
create policy "attachments visible" on public.order_attachments for select to authenticated
  using (public.can_access_order(order_id));
create policy "attachments insert" on public.order_attachments for insert to authenticated
  with check (
    public.current_app_role() = 'admin'
    or (public.current_app_role() = 'technician'
        and exists (select 1 from public.orders o
                    where o.id = order_id
                      and o.assigned_technician_id = public.current_technician_id()
                      and o.status in ('assigned', 'in_progress')))
  );
create policy "attachments delete own" on public.order_attachments for delete to authenticated
  using (
    public.current_app_role() = 'admin'
    or (uploaded_by = auth.uid()
        and exists (select 1 from public.orders o
                    where o.id = order_id and o.status in ('assigned', 'in_progress')))
  );

-- Notifications: own inbox, plus office staff see the outbound WhatsApp log.
create policy "notifications visible" on public.notifications for select to authenticated
  using (
    recipient_profile_id = auth.uid()
    or public.current_app_role() in ('admin', 'manager')
    or (channel = 'whatsapp' and audience = 'customer' and public.can_access_order(order_id))
  );
create policy "notifications update own or office" on public.notifications for update to authenticated
  using (
    recipient_profile_id = auth.uid()
    or public.current_app_role() in ('admin', 'manager')
    or (channel = 'whatsapp' and public.can_access_order(order_id))
  )
  with check (true);

-- AI artefacts: office staff.
create policy "ai flags office read" on public.ai_flags for select to authenticated
  using (public.current_app_role() in ('admin', 'manager'));
create policy "ai flags manager resolve" on public.ai_flags for update to authenticated
  using (public.current_app_role() in ('admin', 'manager'))
  with check (public.current_app_role() in ('admin', 'manager'));
create policy "ai runs office read" on public.ai_runs for select to authenticated
  using (public.current_app_role() in ('admin', 'manager'));
create policy "ai insights office read" on public.ai_insights for select to authenticated
  using (public.current_app_role() in ('admin', 'manager'));

-- ------------------------------------------------------------- storage ------
insert into storage.buckets (id, name, public, file_size_limit)
values ('job-media', 'job-media', false, 52428800)
on conflict (id) do nothing;

-- Object path convention: <order_id>/<uuid>-<filename>   (shared samples live under samples/)
create policy "job media read" on storage.objects for select to authenticated
  using (
    bucket_id = 'job-media'
    and (name like 'samples/%' or public.can_access_order(public.try_uuid(split_part(name, '/', 1))))
  );
create policy "job media upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-media'
    and (
      public.current_app_role() = 'admin'
      or exists (select 1 from public.orders o
                 where o.id = public.try_uuid(split_part(name, '/', 1))
                   and o.assigned_technician_id = public.current_technician_id()
                   and o.status in ('assigned', 'in_progress'))
    )
  );
create policy "job media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'job-media' and owner_id = auth.uid()::text);

-- ------------------------------------------------------------ realtime ------
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.ai_flags;

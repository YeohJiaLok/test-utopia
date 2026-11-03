-- =============================================================================
-- User administration
--  * profiles.active: deactivated accounts lose every permission at once.
--  * profiles is the single source of truth for role + status; a trigger copies
--    both into auth.users.raw_app_meta_data so the JWT claims never drift.
--  * user_admin_events: append-only audit of who created / changed which account.
-- Accounts are created by admins only (server actions with the service role).
-- =============================================================================

-- --------------------------------------------------------------- profiles ---
alter table public.profiles
  add column active     boolean not null default true,
  add column updated_at timestamptz not null default now();

create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public._touch_updated_at();

-- Role + status → JWT app_metadata (read by src/proxy.ts for optimistic routing).
create or replace function public._sync_profile_claims()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', new.role, 'active', new.active)
   where id = new.id;
  return new;
end $$;

create trigger profiles_sync_claims
  after insert or update of role, active on public.profiles
  for each row execute function public._sync_profile_claims();

-- Backfill existing accounts.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('role', p.role, 'active', p.active)
  from public.profiles p
 where p.id = u.id;

-- ------------------------------------------------- deactivated = no access ---
-- Every RLS policy and workflow function goes through these two helpers, so a
-- deactivated user is denied immediately, even while an old token is still valid.
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active $$;

create or replace function public.current_technician_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select t.id
    from public.technicians t
    join public.profiles p on p.id = t.profile_id and p.active
   where t.profile_id = auth.uid()
$$;

-- Own-inbox access also requires an active account.
drop policy "notifications visible" on public.notifications;
drop policy "notifications update own or office" on public.notifications;

create policy "notifications visible" on public.notifications for select to authenticated
  using (
    (recipient_profile_id = auth.uid() and public.current_app_role() is not null)
    or public.current_app_role() in ('admin', 'manager')
    or (channel = 'whatsapp' and audience = 'customer' and public.can_access_order(order_id))
  );
create policy "notifications update own or office" on public.notifications for update to authenticated
  using (
    (recipient_profile_id = auth.uid() and public.current_app_role() is not null)
    or public.current_app_role() in ('admin', 'manager')
    or (channel = 'whatsapp' and public.can_access_order(order_id))
  )
  with check (true);

-- ------------------------------------------------------- admin audit trail ---
create table public.user_admin_events (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles (id) on delete set null,
  actor_name    text not null,
  action        text not null check (action in
                  ('user_created', 'user_updated', 'role_changed', 'user_deactivated', 'user_reactivated', 'password_reset')),
  target_id     uuid references public.profiles (id) on delete set null,
  target_name   text not null,
  target_email  text,
  changes       jsonb not null default '{}',   -- { field: { from, to } }; never contains passwords
  created_at    timestamptz not null default now()
);
create index user_admin_events_created_idx on public.user_admin_events (created_at desc);
create index user_admin_events_target_idx on public.user_admin_events (target_id);

alter table public.user_admin_events enable row level security;

-- Read: office staff. No insert/update/delete policies: only the server (service role) writes it.
create policy "user admin events office read" on public.user_admin_events for select to authenticated
  using (public.current_app_role() in ('admin', 'manager'));

create or replace function public._user_admin_events_append_only()
returns trigger
language plpgsql
as $$
begin
  -- The only allowed change is the FK "set null" when a referenced account is removed.
  if tg_op = 'UPDATE'
     and (new.action, new.actor_name, new.target_name, new.target_email, new.changes, new.created_at)
         is not distinct from (old.action, old.actor_name, old.target_name, old.target_email, old.changes, old.created_at)
  then
    return new;
  end if;
  raise exception 'user_admin_events is append-only';
end $$;

create trigger user_admin_events_no_update
  before update or delete on public.user_admin_events
  for each row execute function public._user_admin_events_append_only();

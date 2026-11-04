-- =============================================================================
-- Two-factor authentication (TOTP: Google Authenticator, Microsoft Authenticator, …).
--
-- Supabase Auth issues sessions at assurance level aal1 (password) or aal2 (password +
-- verified authenticator code); the level is in the JWT `aal` claim. A user who has turned
-- on 2FA must reach aal2 before anything works: the role helpers that every RLS policy,
-- storage policy and workflow function depends on return NULL for a password-only session.
-- So skipping the code screen (typing a URL, calling the database API with the aal1 token)
-- yields no data at all, not just a redirect.
-- =============================================================================

-- True when this session satisfies the user's 2FA requirement.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active and public.mfa_satisfied() $$;

create or replace function public.current_technician_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select t.id
    from public.technicians t
    join public.profiles p on p.id = t.profile_id and p.active
   where t.profile_id = auth.uid()
     and public.mfa_satisfied()
$$;

-- Own profile / technician row stay readable at aal1 (the code screen needs the name);
-- everything else requires the second factor.
drop policy "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated
  using ((id = (select auth.uid())) or public.current_app_role() in ('admin', 'manager'));

-- ----------------------------------------------------------- audit trail ---
alter table public.user_admin_events drop constraint user_admin_events_action_check;
alter table public.user_admin_events add constraint user_admin_events_action_check check (action in (
  'user_created', 'user_updated', 'role_changed', 'user_deactivated', 'user_reactivated', 'password_reset',
  'mfa_enabled', 'mfa_disabled', 'mfa_reset'
));

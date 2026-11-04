-- Everything requireUser() needs about the signed-in user in one round trip:
-- profile, active flag, linked technician and whether the session satisfies 2FA.
-- (Was 2–3 sequential queries per page view.)
create or replace function public.session_context()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.app_role,
  branch_id smallint,
  active boolean,
  technician_id uuid,
  mfa_ok boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.role, p.branch_id, p.active,
         (select t.id from public.technicians t where t.profile_id = p.id limit 1),
         public.mfa_satisfied()
    from public.profiles p
   where p.id = auth.uid()
$$;

revoke all on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;

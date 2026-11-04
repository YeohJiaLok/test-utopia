-- Users with two-factor authentication on, for the admin Users & roles page.
-- (auth.admin.listUsers() does not return factors; this avoids one Auth call per user.)
create or replace function public.mfa_enrolled_users()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only admins can view two-factor status' using errcode = '42501';
  end if;
  return query
    select distinct f.user_id from auth.mfa_factors f where f.status = 'verified';
end;
$$;

revoke all on function public.mfa_enrolled_users() from public, anon;
grant execute on function public.mfa_enrolled_users() to authenticated;

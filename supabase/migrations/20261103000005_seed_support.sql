-- Seed support: after bulk-loading historical orders with explicit order numbers,
-- move the order number sequence past the highest suffix. Service role only.
create or replace function public.sync_order_no_seq()
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_max bigint;
begin
  select coalesce(max(nullif(regexp_replace(order_no, '^.*-', ''), '')::bigint), 1000)
    into v_max from public.orders;
  perform setval('public.order_no_seq', v_max);
  return v_max;
end $$;

revoke execute on function public.sync_order_no_seq() from public, anon, authenticated;
grant execute on function public.sync_order_no_seq() to service_role;

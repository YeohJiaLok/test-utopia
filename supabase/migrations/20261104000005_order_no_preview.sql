-- Next order number for the New order screen's preview.
-- Reads the sequence without consuming it (nextval would burn a number on every page view).
-- The number is only reserved when create_order() inserts the row, so with two admins
-- creating at the same moment the saved number can be a later one; the success screen
-- always shows the number actually saved.
create or replace function public.peek_next_order_no()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_last bigint;
  v_called boolean;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Only admins can create orders' using errcode = '42501';
  end if;
  select last_value, is_called into v_last, v_called from public.order_no_seq;
  return 'SJK-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM') || '-' ||
         lpad((case when v_called then v_last + 1 else v_last end)::text, 5, '0');
end;
$$;

revoke all on function public.peek_next_order_no() from public, anon;
grant execute on function public.peek_next_order_no() to authenticated;

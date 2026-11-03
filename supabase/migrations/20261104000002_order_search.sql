-- =============================================================================
-- Global order search (command palette / ⌘K)
--  * One ranked, typo-tolerant search over order number, customer, phone (any
--    formatting), address, problem, technician, service, branch and status.
--  * SECURITY INVOKER: runs with the caller's RLS, so technicians only ever find
--    their own jobs and the function can never widen access.
--  * pg_trgm GIN indexes keep substring / fuzzy matching fast as orders grow.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Document of the order's own searchable text (immutable expression → indexable).
create index if not exists orders_search_doc_trgm_idx on public.orders using gin (
  (lower(order_no || ' ' || customer_name || ' ' || customer_address || ' ' || problem_description))
  extensions.gin_trgm_ops
);
-- Phone digits only, so "0123456789", "012-345 6789" and "+60 12 345 6789" all match.
create index if not exists orders_phone_digits_trgm_idx on public.orders using gin (
  (regexp_replace(customer_phone, '\D', '', 'g')) extensions.gin_trgm_ops
);

create or replace function public.search_orders(p_query text, p_limit integer default 12)
returns table (
  id               uuid,
  order_no         text,
  customer_name    text,
  customer_phone   text,
  customer_address text,
  status           public.order_status,
  scheduled_at     timestamptz,
  service_name     text,
  technician_name  text,
  branch_name      text,
  matched_on       text,
  score            real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select
      lower(btrim(coalesce(p_query, '')))                                  as t,
      regexp_replace(coalesce(p_query, ''), '\D', '', 'g')                 as digits,
      -- Malaysian numbers: also try without the 60 country code / leading 0.
      regexp_replace(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '^(60|0)', '') as local_digits,
      array_remove(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+'), '') as tokens
  ),
  docs as (
    select
      o.id, o.order_no, o.customer_name, o.customer_phone, o.customer_address, o.status, o.scheduled_at,
      o.created_at, o.problem_description,
      st.name as service_name, t.name as technician_name, b.name as branch_name,
      regexp_replace(o.customer_phone, '\D', '', 'g') as phone_digits,
      lower(concat_ws(' ',
        o.order_no, o.customer_name, o.customer_phone, regexp_replace(o.customer_phone, '\D', '', 'g'),
        o.customer_address, o.problem_description, st.name, st.code, t.name, t.team_code, b.name, b.code,
        replace(o.status::text, '_', ' '),
        case o.status when 'job_done' then 'done completed' when 'in_progress' then 'on site started' else '' end
      )) as doc
    from public.orders o
    left join public.service_types st on st.id = o.service_type_id
    left join public.technicians  t  on t.id  = o.assigned_technician_id
    left join public.branches     b  on b.id  = o.branch_id
  ),
  scored as (
    select
      d.*,
      -- every word must appear somewhere (AND search) …
      not exists (select 1 from unnest(q.tokens) tok where position(tok in d.doc) = 0) as all_tokens,
      -- … or a close fuzzy match for typos ("benny wnog", "shah alm")
      word_similarity(q.t, d.doc) as fuzzy,
      q.t, q.digits, q.local_digits
    from docs d, q
    where length(q.t) >= 2
  ),
  ranked as (
    select
      s.*,
      (s.all_tokens or (length(s.local_digits) >= 4 and position(s.local_digits in s.phone_digits) > 0)) as strong
    from scored s
  ),
  gated as (
    -- Fuzzy (typo) matches only when nothing matches exactly, and never for number-only
    -- queries: "01400" should return that order, not 10 orders that merely look similar.
    select r.*, bool_or(r.strong) over () as any_strong
    from ranked r
  )
  select
    s.id, s.order_no, s.customer_name, s.customer_phone, s.customer_address, s.status, s.scheduled_at,
    s.service_name, s.technician_name, s.branch_name,
    case
      when lower(s.order_no) = s.t or lower(s.order_no) like '%' || s.t                         then 'Order number'
      when position(s.t in lower(s.order_no)) > 0                                               then 'Order number'
      when length(s.local_digits) >= 4 and position(s.local_digits in s.phone_digits) > 0       then 'Phone'
      when position(s.t in lower(s.customer_name)) > 0                                          then 'Customer'
      when position(s.t in lower(coalesce(s.technician_name, ''))) > 0                          then 'Technician'
      when position(s.t in lower(s.customer_address)) > 0                                       then 'Address'
      when position(s.t in lower(coalesce(s.service_name, ''))) > 0                             then 'Service'
      when position(s.t in lower(coalesce(s.branch_name, ''))) > 0                              then 'Branch'
      when position(s.t in lower(s.problem_description)) > 0                                    then 'Problem'
      when s.all_tokens                                                                         then 'Multiple fields'
      else 'Similar'
    end as matched_on,
    (
      case
        when lower(s.order_no) = s.t                                                   then 100
        when lower(s.order_no) like '%' || s.t                                         then 90
        when position(s.t in lower(s.order_no)) > 0                                    then 80
        when length(s.local_digits) >= 4 and position(s.local_digits in s.phone_digits) > 0 then 75
        when lower(s.customer_name) like s.t || '%'                                    then 65
        when position(s.t in lower(s.customer_name)) > 0                               then 55
        when position(s.t in lower(coalesce(s.technician_name, ''))) > 0               then 45
        when s.all_tokens                                                              then 40
        else 0
      end
      + s.fuzzy * 20
      -- small boost for live work over archived jobs
      + case when s.status in ('new', 'assigned', 'in_progress', 'job_done') then 5 else 0 end
    )::real as score
  from gated s
  where s.strong
     or (not s.any_strong
         and s.fuzzy >= 0.55
         and length(s.t) >= 3
         and length(s.digits) * 2 < length(s.t))
  order by score desc, s.scheduled_at desc nulls last, s.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.search_orders(text, integer) from public, anon;
grant execute on function public.search_orders(text, integer) to authenticated;

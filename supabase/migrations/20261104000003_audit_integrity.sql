-- =============================================================================
-- Tamper-evident order audit trail
--  * order_events becomes a SHA-256 hash chain: every row stores the previous
--    row's hash and its own hash over its full content. Editing, deleting or
--    reordering any row breaks the chain; verify_audit_chain() proves it.
--  * A single chain-head row serialises writers (row lock) and records the
--    latest hash, so deleting the newest rows is detected too.
--  * UPDATE is rejected for everyone. DELETE is allowed only for the service
--    role (demo-data reset / retention jobs), never for app users.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

alter table public.order_events
  add column chain_seq bigint,
  add column prev_hash bytea,
  add column row_hash  bytea;

-- Canonical digest of one event. jsonb_build_array gives an unambiguous, null-safe
-- encoding; created_at is hashed as epoch seconds so the session time zone is irrelevant.
create or replace function public._order_event_digest(
  p_prev bytea, p_seq bigint, p_id bigint, p_order uuid, p_actor uuid, p_actor_name text,
  p_actor_role public.app_role, p_action text, p_from public.order_status, p_to public.order_status,
  p_payload jsonb, p_created timestamptz
)
returns bytea
language sql
stable
set search_path = public, extensions
as $$
  select extensions.digest(
    encode(coalesce(p_prev, ''::bytea), 'hex') || '|' ||
    jsonb_build_array(p_seq, p_id, p_order, p_actor, p_actor_name, p_actor_role, p_action, p_from, p_to,
                      p_payload, extract(epoch from p_created))::text,
    'sha256')
$$;

create table public.audit_chain_head (
  chain      text primary key,
  seq        bigint not null default 0,
  head_hash  bytea,
  reset_at   timestamptz not null default now()
);
alter table public.audit_chain_head enable row level security;   -- no policies: only definer functions touch it

-- Backfill existing events in chronological order.
do $$
declare
  r     record;
  prev  bytea := null;
  n     bigint := 0;
  h     bytea;
begin
  for r in select * from public.order_events order by created_at, id loop
    n := n + 1;
    h := public._order_event_digest(prev, n, r.id, r.order_id, r.actor_id, r.actor_name, r.actor_role, r.action,
                                    r.from_status, r.to_status, r.payload, r.created_at);
    update public.order_events set chain_seq = n, prev_hash = prev, row_hash = h where id = r.id;
    prev := h;
  end loop;
  insert into public.audit_chain_head (chain, seq, head_hash) values ('order_events', n, prev);
end $$;

alter table public.order_events
  alter column chain_seq set not null,
  alter column row_hash  set not null;
create unique index order_events_chain_seq_idx on public.order_events (chain_seq);

-- Link each new event to the head (row lock = one writer at a time, so the chain is linear).
create or replace function public._order_events_chain()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h public.audit_chain_head;
begin
  select * into h from public.audit_chain_head where chain = 'order_events' for update;
  new.chain_seq := h.seq + 1;
  new.prev_hash := h.head_hash;
  new.row_hash  := public._order_event_digest(h.head_hash, new.chain_seq, new.id, new.order_id, new.actor_id,
                     new.actor_name, new.actor_role, new.action, new.from_status, new.to_status, new.payload,
                     new.created_at);
  update public.audit_chain_head set seq = new.chain_seq, head_hash = new.row_hash where chain = 'order_events';
  return new;
end $$;

create trigger order_events_chain
  before insert on public.order_events
  for each row execute function public._order_events_chain();

create or replace function public._order_events_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and coalesce(auth.role(), '') = 'service_role' then
    return old;   -- demo-data reset / retention jobs only; still detected by verify_audit_chain()
  end if;
  raise exception 'order_events is append-only' using errcode = 'insufficient_privilege';
end $$;

create trigger order_events_append_only
  before update or delete on public.order_events
  for each row execute function public._order_events_append_only();

-- Restart the chain after a full demo-data wipe (service role, empty table only).
create or replace function public.reset_audit_chain()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'reset_audit_chain is restricted to the service role';
  end if;
  if exists (select 1 from public.order_events) then
    raise exception 'the audit chain can only be reset when order_events is empty';
  end if;
  update public.audit_chain_head set seq = 0, head_hash = null, reset_at = now() where chain = 'order_events';
end $$;

-- Recompute the whole chain. ok = every hash matches, links are contiguous from #1,
-- and the stored head matches the last row (detects deleted tail rows).
create or replace function public.verify_audit_chain()
returns table (
  ok           boolean,
  checked      bigint,
  last_seq     bigint,
  broken_seq   bigint,
  reason       text,
  head_hash    text,
  verified_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  r       record;
  h       public.audit_chain_head;
  prev    bytea := null;
  expect  bytea;
  n       bigint := 0;
  lastn   bigint := 0;
  bad     bigint := null;
  why     text := null;
begin
  if coalesce(public.current_app_role()::text, '') not in ('admin', 'manager')
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'verify_audit_chain is restricted to admins and managers';
  end if;

  select * into h from public.audit_chain_head where chain = 'order_events';

  for r in select * from public.order_events order by chain_seq loop
    if r.chain_seq <> lastn + 1 then
      bad := lastn + 1; why := 'missing event(s) before #' || r.chain_seq; exit;
    end if;
    if r.prev_hash is distinct from prev then
      bad := r.chain_seq; why := 'link to previous event does not match'; exit;
    end if;
    expect := public._order_event_digest(r.prev_hash, r.chain_seq, r.id, r.order_id, r.actor_id, r.actor_name,
                r.actor_role, r.action, r.from_status, r.to_status, r.payload, r.created_at);
    if expect <> r.row_hash then
      bad := r.chain_seq; why := 'content changed after it was written'; exit;
    end if;
    prev := r.row_hash; lastn := r.chain_seq; n := n + 1;
  end loop;

  if bad is null and (h.seq <> lastn or h.head_hash is distinct from prev) then
    bad := lastn + 1; why := 'newest event(s) were removed';
  end if;

  return query select bad is null, n, lastn, bad, why, encode(h.head_hash, 'hex'), now();
end $$;

revoke all on function public._order_event_digest(bytea, bigint, bigint, uuid, uuid, text, public.app_role, text, public.order_status, public.order_status, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.reset_audit_chain() from public, anon, authenticated;
grant execute on function public.reset_audit_chain() to service_role;
revoke all on function public.verify_audit_chain() from public, anon;
grant execute on function public.verify_audit_chain() to authenticated, service_role;

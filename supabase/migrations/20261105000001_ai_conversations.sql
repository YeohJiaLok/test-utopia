-- =============================================================================
-- Sejuk Ops AI: saved conversation history.
--
-- Enterprise model:
--  * Private: a conversation is visible only to its owner (not other users, not admins).
--    Governance does not depend on it: every question/answer is also in ai_runs, which
--    users cannot edit or delete.
--  * Server-written: messages are inserted only by the server (service role) after a run,
--    and the server builds the model's context from these rows. A user cannot plant fake
--    earlier turns to steer the model.
--  * User control: the owner can rename (title only) and delete their conversations.
--    Deleting history never touches the audit log.
--  * Retention: conversations idle for 90 days are purged daily (data minimisation, PDPA).
-- =============================================================================

create table public.ai_conversations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 120),
  message_count  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null default '' check (char_length(content) <= 40000),
  status           text not null default 'done' check (status in ('done', 'error', 'stopped')),
  -- Rendering data for the assistant turn (agent steps, charts, order chips, policy badge).
  steps            jsonb not null default '[]',
  charts           jsonb not null default '[]',
  records          jsonb not null default '[]',
  policy           jsonb,
  error            text,
  latency_ms       integer,
  run_id           uuid references public.ai_runs (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, id);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Owner only, and only office roles whose session satisfies 2FA (current_app_role()).
create policy "ai conversations own" on public.ai_conversations for select to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) in ('admin', 'manager'));
create policy "ai conversations rename own" on public.ai_conversations for update to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) in ('admin', 'manager'))
  with check (user_id = (select auth.uid()));
create policy "ai conversations delete own" on public.ai_conversations for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) in ('admin', 'manager'));

create policy "ai messages own" on public.ai_messages for select to authenticated
  using (user_id = (select auth.uid()) and (select public.current_app_role()) in ('admin', 'manager'));

-- Least privilege: users read, rename (title only) and delete their own; the server writes.
revoke all on public.ai_conversations, public.ai_messages from anon, authenticated;
grant select, delete on public.ai_conversations to authenticated;
grant update (title) on public.ai_conversations to authenticated;
grant select on public.ai_messages to authenticated;

-- ------------------------------------------------------------- retention ---
create or replace function public.purge_expired_ai_conversations(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.ai_conversations where updated_at < now() - make_interval(days => p_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_expired_ai_conversations(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_ai_conversations(integer) to service_role;

-- Daily purge at 03:15 MYT (19:15 UTC) when pg_cron is available; listing also hides
-- anything past retention, so the policy holds even without the scheduler.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('purge-ai-conversations', '15 19 * * *', 'select public.purge_expired_ai_conversations(90)');
exception when others then
  raise notice 'pg_cron not available (%); retention is enforced at read time only', sqlerrm;
end;
$$;

-- =============================================================================
-- Sejuk Sejuk Ops — core schema
-- Order lifecycle: new → assigned → in_progress → job_done → reviewed → closed
-- =============================================================================

-- ---------------------------------------------------------------- enums ------
create type public.app_role as enum ('admin', 'technician', 'manager');
create type public.order_status as enum ('new', 'assigned', 'in_progress', 'job_done', 'reviewed', 'closed');
create type public.attachment_kind as enum ('photo', 'video', 'pdf', 'receipt');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'ewallet', 'unpaid');
create type public.flag_severity as enum ('low', 'medium', 'high');
create type public.notification_channel as enum ('whatsapp', 'in_app');
create type public.notification_audience as enum ('customer', 'technician', 'manager', 'accounts');

-- ------------------------------------------------------------ reference ------
create table public.branches (
  id          smallint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  state       text not null,
  created_at  timestamptz not null default now()
);

create table public.service_types (
  id           smallint generated always as identity primary key,
  code         text not null unique,
  name         text not null,
  base_price   numeric(10,2) not null check (base_price >= 0),
  est_minutes  integer not null default 60,
  active       boolean not null default true
);

-- --------------------------------------------------------------- people ------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text,
  role        public.app_role not null,
  branch_id   smallint references public.branches (id),
  phone       text,
  created_at  timestamptz not null default now()
);

-- Field teams. A technician may or may not have a login (profile_id).
create table public.technicians (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles (id) on delete set null,
  name        text not null,
  phone       text not null,
  branch_id   smallint not null references public.branches (id),
  team_code   text not null,
  skills      text[] not null default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  address     text not null,
  branch_id   smallint references public.branches (id),
  created_at  timestamptz not null default now()
);
create index customers_phone_idx on public.customers (phone);

-- --------------------------------------------------------------- orders ------
create sequence public.order_no_seq start 1001;

-- Human-friendly, sortable, month-bucketed order number: SJK-2611-01001
create or replace function public.next_order_no()
returns text
language sql
volatile
as $$
  select 'SJK-' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM') || '-' ||
         lpad(nextval('public.order_no_seq')::text, 5, '0');
$$;

create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  order_no                text not null unique default public.next_order_no(),
  customer_id             uuid references public.customers (id),
  customer_name           text not null,
  customer_phone          text not null,
  customer_address        text not null,
  branch_id               smallint references public.branches (id),
  service_type_id         smallint not null references public.service_types (id),
  problem_description     text not null,
  quoted_price            numeric(10,2) not null check (quoted_price >= 0),
  assigned_technician_id  uuid references public.technicians (id),
  admin_notes             text,
  status                  public.order_status not null default 'new',
  scheduled_at            timestamptz,
  reschedule_count        integer not null default 0,
  source                  text not null default 'manual',   -- manual | ai_document
  created_by              uuid references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  assigned_at             timestamptz,
  started_at              timestamptz,
  completed_at            timestamptz,
  reviewed_at             timestamptz,
  closed_at               timestamptz
);
create index orders_status_idx on public.orders (status);
create index orders_tech_idx on public.orders (assigned_technician_id, status);
create index orders_completed_idx on public.orders (completed_at);
create index orders_created_idx on public.orders (created_at desc);

-- One completion record per order (Module 2).
create table public.job_completions (
  order_id        uuid primary key references public.orders (id) on delete cascade,
  technician_id   uuid not null references public.technicians (id),
  work_done       text not null,
  quoted_price    numeric(10,2) not null,                       -- snapshot at completion
  extra_charges   numeric(10,2) not null default 0 check (extra_charges >= 0),
  final_amount    numeric(10,2) generated always as (quoted_price + extra_charges) stored,
  remarks         text,
  payment_amount  numeric(10,2) check (payment_amount is null or payment_amount >= 0),
  payment_method  public.payment_method,
  receipt_path    text,
  completed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index job_completions_tech_idx on public.job_completions (technician_id, completed_at);

create table public.order_attachments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  kind          public.attachment_kind not null,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null default 0,
  uploaded_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index order_attachments_order_idx on public.order_attachments (order_id);

-- Append-only audit trail. Written only by security-definer workflow functions.
create table public.order_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  actor_id     uuid references public.profiles (id),
  actor_name   text,
  actor_role   public.app_role,
  action       text not null,
  from_status  public.order_status,
  to_status    public.order_status,
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);
create index order_events_created_idx on public.order_events (created_at desc);

create table public.reschedules (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  technician_id     uuid references public.technicians (id),
  old_scheduled_at  timestamptz,
  new_scheduled_at  timestamptz not null,
  reason            text not null,
  requested_by      uuid references public.profiles (id),
  created_at        timestamptz not null default now()
);
create index reschedules_tech_idx on public.reschedules (technician_id, created_at);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.orders (id) on delete cascade,
  manager_id  uuid references public.profiles (id),
  rating      smallint check (rating between 1 and 5),
  decision    text not null check (decision in ('approved', 'rework')),
  notes       text,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------- notifications ------
create table public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid references public.orders (id) on delete cascade,
  channel               public.notification_channel not null,
  audience              public.notification_audience not null,
  recipient_profile_id  uuid references public.profiles (id),
  recipient_phone       text,
  template              text not null,
  title                 text not null,
  message               text not null,
  deep_link             text,
  status                text not null default 'pending' check (status in ('pending', 'opened', 'sent', 'read')),
  created_at            timestamptz not null default now(),
  read_at               timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient_profile_id, created_at desc);
create index notifications_audience_idx on public.notifications (audience, created_at desc);

-- ------------------------------------------------------------------- AI ------
-- Workflow Supervisor output (rule engine + AI reviewer).
create table public.ai_flags (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  rule_code           text not null,
  severity            public.flag_severity not null,
  source              text not null check (source in ('rule', 'ai')),
  title               text not null,
  explanation         text not null,
  recommended_action  text,
  evidence            jsonb not null default '{}',
  resolved            boolean not null default false,
  resolved_by         uuid references public.profiles (id),
  resolved_at         timestamptz,
  resolution_note     text,
  created_at          timestamptz not null default now(),
  unique (order_id, rule_code)
);
create index ai_flags_open_idx on public.ai_flags (resolved, severity, created_at desc);

-- AI governance log: every model invocation, its tool calls and cost.
create table public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('copilot', 'supervisor', 'extraction', 'insight')),
  user_id        uuid references public.profiles (id),
  input          text,
  tool_calls     jsonb not null default '[]',
  output         text,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  latency_ms     integer,
  status         text not null default 'ok' check (status in ('ok', 'error', 'refused', 'blocked')),
  error          text,
  created_at     timestamptz not null default now()
);
create index ai_runs_created_idx on public.ai_runs (created_at desc);

-- Cached AI operational briefings (one per period + scope).
create table public.ai_insights (
  id            uuid primary key default gen_random_uuid(),
  period_start  date not null,
  period_end    date not null,
  scope         text not null default 'company',
  content       jsonb not null,
  generated_by  uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  unique (period_start, scope)
);

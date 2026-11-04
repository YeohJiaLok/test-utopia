-- Cancelled: a terminal status beside the main lifecycle. An order can be cancelled
-- (with a reason) before the work is done; it is kept for history and the audit trail.
-- (Separate migration: a new enum value can't be used in the transaction that adds it.)
alter type public.order_status add value if not exists 'cancelled';

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles (id),
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text;

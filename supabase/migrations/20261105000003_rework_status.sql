-- Rework: a job the manager sent back is its own status, not "In Progress" again,
-- so everyone (technician, admin, manager, KPIs, AI) can see it was returned.
--   Job Done → (manager: request rework) → Rework → (technician: resubmit) → Job Done
-- (Separate migration: a new enum value can't be used in the transaction that adds it.)
alter type public.order_status add value if not exists 'rework' after 'in_progress';

-- How many times the job was sent back (quality KPI; 0 for first-time-right jobs).
alter table public.orders
  add column if not exists rework_count integer not null default 0;

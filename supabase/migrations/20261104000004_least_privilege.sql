-- =============================================================================
-- Least-privilege hardening.
--
-- Found by a privilege-escalation test run with a technician's own token straight
-- against the database API (the publishable key is public, so the browser app is not
-- the only client). Every portal guard held; these are the gaps that test exposed:
--   * a technician could rewrite the customer WhatsApp message, link and recipient on
--     their own job (phishing vector) because the notifications UPDATE policy had
--     `with check (true)` and every column was writable;
--   * every signed-in user could list all staff emails, roles and phone numbers;
--   * admins/managers could rewrite orders, customers and AI findings directly,
--     bypassing the audited workflow functions.
-- Rule after this migration: signed-in users only READ through RLS. Every write goes
-- through a SECURITY DEFINER workflow function (audited in order_events) or, for the
-- few user-owned fields, through an explicit column-level grant.
-- =============================================================================

-- ------------------------------------------------------------ baseline -----
-- Supabase grants ALL (incl. TRUNCATE, which ignores RLS) on public tables to anon and
-- authenticated. The app has no anonymous data access at all, and nothing needs
-- TRUNCATE / TRIGGER / REFERENCES.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- ----------------------------------------------------- staff directory -----
-- Technicians see only their own profile / technician record; office staff see all.
drop policy "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.current_app_role() in ('admin', 'manager'));

drop policy "technicians readable" on public.technicians;
create policy "technicians readable" on public.technicians for select to authenticated
  using (profile_id = (select auth.uid()) or public.current_app_role() in ('admin', 'manager'));

-- Profiles and technicians are managed only by admin user management (service role).
revoke insert, update, delete on public.profiles, public.technicians from authenticated;

-- ------------------------------------------- workflow-owned tables -----
-- Orders and everything hanging off them change only through the workflow functions
-- (create_order, assign_technician, start_job, complete_job, review_job, close_job,
-- reschedule_order), which are SECURITY DEFINER and append to the audit chain.
drop policy "orders admin edit details" on public.orders;
drop policy "customers admin write" on public.customers;
revoke insert, update, delete on
  public.orders, public.customers, public.job_completions, public.reviews,
  public.reschedules, public.order_events, public.user_admin_events,
  public.ai_runs, public.ai_insights, public.audit_chain_head
from authenticated;

-- ------------------------------------------------------- notifications -----
-- Message, link and recipient are rendered by DB triggers and are immutable.
-- Users may only record that a message was opened / read.
revoke insert, update, delete on public.notifications from authenticated;
grant update (status, read_at) on public.notifications to authenticated;

drop policy "notifications update own or office" on public.notifications;
create policy "notifications update own or office" on public.notifications for update to authenticated
  using (
    (recipient_profile_id = (select auth.uid()) and public.current_app_role() is not null)
    or public.current_app_role() in ('admin', 'manager')
    or (channel = 'whatsapp' and public.can_access_order(order_id))
  )
  with check (
    (recipient_profile_id = (select auth.uid()) and public.current_app_role() is not null)
    or public.current_app_role() in ('admin', 'manager')
    or (channel = 'whatsapp' and public.can_access_order(order_id))
  );

-- ------------------------------------------------------------ AI flags -----
-- The supervisor's findings are evidence: reviewers can only record a resolution,
-- once, in their own name. (Flags are written by the service role.)
revoke insert, update, delete on public.ai_flags from authenticated;
grant update (resolved, resolved_by, resolved_at, resolution_note) on public.ai_flags to authenticated;

drop policy "ai flags manager resolve" on public.ai_flags;
create policy "ai flags manager resolve" on public.ai_flags for update to authenticated
  using (public.current_app_role() in ('admin', 'manager') and not resolved)
  with check (
    public.current_app_role() in ('admin', 'manager')
    and resolved
    and resolved_by = (select auth.uid())
  );

-- ------------------------------------------------------ reference data -----
-- Service types / branches are configuration: read-only for users.
drop policy "service types admin write" on public.service_types;
revoke insert, update, delete on public.service_types, public.branches from authenticated;

@AGENTS.md

# Sejuk Ops — engineering conventions

Enterprise service-operations platform (Next.js 16 App Router · Supabase · Claude). Read this before writing code.

## Architecture rules
- **Database is the source of truth for the workflow.** Orders move `new → assigned → in_progress → job_done → reviewed → closed`
  only through SQL functions (`supabase/migrations/*_workflow.sql`): `create_order`, `assign_technician`, `start_job`,
  `complete_job`, `review_job`, `close_job`, `reschedule_order`, `cancel_order`. Call them with `supabase.rpc(...)`.
  `cancelled` is a terminal side status (admin only, from new/assigned/in_progress, reason required; triggers notify the
  technician + customer); it is not in `ORDER_STATUSES` (the pipeline) but is in `ALL_STATUSES`. `create_order` requires a
  technician. A trigger rejects direct
  status/assignment updates. Every call appends to `order_events` (audit trail).
- **RLS everywhere.** Server code reads/writes with the user-scoped client `createClient()` from `@/lib/supabase/server`.
  The service-role client (`@/lib/supabase/admin`) is only for system writes users must not forge (AI runs/flags/insights)
  and for admin user management (`/admin/users` actions, behind `requireUser(["admin"])`, audited to `user_admin_events`).
- **Auth:** call `requireUser(roles?)` from `@/lib/auth` at the top of every page and every server action. Sign-in is
  email + password only; the role in `profiles` decides the portal. Deactivated profiles (`active = false`) are signed out.
- **AI is agentic and governed:** tools are whitelisted, read-only, parameterised, row-capped queries; never raw SQL.
  Every model call is logged to `ai_runs`. Contracts between AI and modules: `src/lib/ai/contracts.ts`.
- Notifications (WhatsApp deep links + in-app) are produced by DB triggers; UI reads the `notifications` table.
- `order_events` is an append-only SHA-256 hash chain (`*_audit_integrity.sql`): never update it; only the service role may
  delete (demo reset), and the seed calls `reset_audit_chain()` after its wipe. `verify_audit_chain()` checks it.
- Order search goes through `search_orders(p_query, p_limit)` (RLS-scoped, ranked, typo-tolerant) — don't hand-roll `ilike`.
- **Security is enterprise grade at every layer — a user must never reach another role's portal or data by editing the
  URL, the token, or by calling the database API directly with the public key.** Enforce the role in all three places:
  `src/proxy.ts` (URL guard), `requireUser([...roles])` / `authorizeApi` (pages, actions, API routes) and Postgres
  (RLS + SECURITY DEFINER workflow functions). Authorization comes only from `profiles.role` (mirrored to JWT
  `app_metadata`), never from email/domain, `user_metadata`, query params or anything the browser sends.
- Least privilege (`*_least_privilege.sql`): signed-in users READ through RLS; writes go through workflow functions or
  explicit column grants (`notifications(status, read_at)`, `ai_flags` resolution fields). Technicians see only their own
  profile/technician row. `anon` has no table access. New tables: enable RLS, add policies, and grant no write by default.
- **Two-factor authentication (TOTP)** is self-service from the user menu (`components/shell/mfa-sheet.tsx`, actions in
  `app/(app)/mfa-actions.ts`, helpers in `lib/mfa.ts`); sign-in's code step is `/login/verify`. Enforcement is in Postgres:
  `mfa_satisfied()` gates `current_app_role()` / `current_technician_id()`, so an aal1 session of a 2FA user gets no data.
  `requireUser` sends such sessions to `/login/verify`. Admins reset lost phones from Users & roles (audited `mfa_reset`).
- After any change to auth, routes, RLS, grants or functions run `npm run security:check` (dev server up): it signs in as
  a technician and fires 86 escalation attacks (incl. 2FA bypasses); every one must report BLOCKED. Add a case for each new route/table/RPC.

## Next.js 16 specifics
- `middleware` is now `src/proxy.ts`. `params` / `searchParams` are Promises.
- Type page props explicitly: `{ params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }`
  (generated `PageProps<"/route">` helpers are not available before `next typegen`).
- Cache Components is off; pages render dynamically per request. After a mutation call `revalidatePath(...)`.

## UI conventions
- shadcn/ui here is built on **Base UI**, not Radix: use the `render` prop instead of `asChild`
  (e.g. `<PopoverTrigger render={<Button variant="ghost" />}>`). For form dropdowns prefer `NativeSelect`
  from `@/components/shared/form-field` (best on mobile).
- `cn` from `@/lib/utils`. Icons: `lucide-react`. Toasts: `sonner`. Forms: react-hook-form + zod v4 (`z.email()` etc.).
- Animation: `motion/react` plus primitives in `@/components/motion` (`FadeIn`, `Stagger`/`StaggerItem`, `CountUp`, `EASE`).
  Keep motion subtle and purposeful; `MotionConfig reducedMotion="user"` is global.
- Shared building blocks: `@/components/shared/*` (PageHeader, StatusBadge, SeverityBadge, StatusPipeline, StatCard,
  EmptyState, FormField, NativeSelect) and `@/components/orders/*` (OrderTimeline, AttachmentGallery, WhatsAppButton).
- Formatting: `@/lib/format` (MYR currency, Malaysia time); ranges: `@/lib/time` (`getRange("this_week")`, weeks start Monday).
- Workflow UI rules: `@/lib/workflow` (`STATUS_META`, `canPerform`, `workflowErrorMessage`). Routes: `@/lib/routes`.
- Technician screens are mobile-first: large touch targets (h-11+), sticky bottom actions, one task per screen —
  but every portal (technician included) must also have a full desktop layout; check 390 px and 1440 px.
- Portal theming: the shell sets `data-portal` (admin indigo, technician emerald, manager azure). Use tokens
  (`primary`, `brand`, `bg-gradient-brand`, `shadow-brand/25`, `ring`), never hard-coded sky/indigo/emerald for accents.
- Dev server is shared while editing: never leave a broken import between saves (a build error overlays every page).

## Commands
- `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run db:seed` · `npm run security:check`

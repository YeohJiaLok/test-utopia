@AGENTS.md

# Sejuk Ops — engineering conventions

Enterprise service-operations platform (Next.js 16 App Router · Supabase · Claude). Read this before writing code.

## Architecture rules
- **Database is the source of truth for the workflow.** Orders move `new → assigned → in_progress → job_done → reviewed → closed`
  only through SQL functions (`supabase/migrations/*_workflow.sql`): `create_order`, `assign_technician`, `start_job`,
  `complete_job`, `review_job`, `close_job`, `reschedule_order`. Call them with `supabase.rpc(...)`. A trigger rejects direct
  status/assignment updates. Every call appends to `order_events` (audit trail).
- **RLS everywhere.** Server code reads/writes with the user-scoped client `createClient()` from `@/lib/supabase/server`.
  The service-role client (`@/lib/supabase/admin`) is only for system writes users must not forge (AI runs/flags/insights).
- **Auth:** call `requireUser(roles?)` from `@/lib/auth` at the top of every page and every server action.
- **AI is agentic and governed:** tools are whitelisted, read-only, parameterised, row-capped queries; never raw SQL.
  Every model call is logged to `ai_runs`. Contracts between AI and modules: `src/lib/ai/contracts.ts`.
- Notifications (WhatsApp deep links + in-app) are produced by DB triggers; UI reads the `notifications` table.

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
- Technician screens are mobile-first: large touch targets (h-11+), sticky bottom actions, one task per screen.

## Commands
- `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run db:seed`

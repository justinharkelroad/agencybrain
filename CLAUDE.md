# CLAUDE.md

## Working Rules

- **NEVER fabricate or invent information.** Say "I don't know" if uncertain.
- **After fixing a production bug**, add a rule here preventing recurrence.
- **Before modifying a function** that writes to a constrained table, check this file and `supabase/CLAUDE.md` for rules about that table.
- **Never re-create a function from scratch** — read the current version first and preserve all protective patterns (GREATEST, COALESCE, exception handlers, required columns).

## Tech Stack

React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL + Edge Functions + Deno)

## Commands

```bash
npm run dev          # Dev server (localhost:8080)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npx vitest run src/tests/your-test.test.ts  # Single file
npx vitest run -t "pattern"                 # By pattern
```

## Architecture

```
React Components → React Query hooks → Supabase SDK → Edge Functions → PostgreSQL (RLS)
```

- `src/components/` — React components (includes `ui/` for shadcn/ui)
- `src/pages/` — Route-level pages (`admin/`, `agency/`, `staff/`)
- `src/hooks/` — Custom React hooks
- `src/lib/` — Core utilities (`auth.tsx`, `supabaseClient.ts`, `utils.ts`)
- `src/config/navigation.ts` — Hierarchical nav with role-based access
- `supabase/functions/` — Deno edge functions
- `supabase/migrations/` — Database migrations

State: AuthProvider (`src/lib/auth.tsx`) + Zustand (global stores) + React Query (server state)

Path alias: `@/*` → `./src/*`

## CI/CD

Edge functions auto-deploy on push to `main`. Gated by `.github/workflows/edge-deploy-gates.yml` (Gate A: functions match config.toml; Gate B: schema validation; Gate C: KPI smoke test).

## Testing

- **Vitest** with jsdom, setup in `src/tests/setup.ts`. Supabase client auto-mocked.
- **Playwright** E2E in `src/tests/e2e/`
- Co-located unit tests: `src/utils/*.test.ts`

## Multi-Tenant Auth (4 User Types — MANDATORY)

Every RLS policy, edge function, and frontend component must account for all four user types.

| User Type | Auth Method | ID Source | Agency Resolution |
|-----------|------------|-----------|-------------------|
| Admin | JWT | `profiles.id` | `profiles.role = 'admin'` (all agencies) |
| Agency Owner | JWT | `profiles.id` | `profiles.agency_id` |
| Key Employee | JWT | `profiles.id` + `key_employees.user_id` | `key_employees.agency_id` |
| Staff User | `x-staff-session` header OR `session_token` body | `staff_users.id` (NOT in `auth.users`) | `staff_users.agency_id` |

### Rule 1: ALWAYS use `has_agency_access()` in RLS

```sql
-- CORRECT:
CREATE POLICY "x" ON t FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

-- WRONG (blocks key employees + staff):
... WHERE agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
```

**NEVER** write `FROM profiles WHERE id = auth.uid()` in any RLS policy. It's always a bug.

### Rule 2: Edge functions MUST include staff CORS headers

Import `corsHeaders` from `../_shared/cors.ts`, or include `x-staff-session, x-staff-session-token` in `Access-Control-Allow-Headers`.

### Rule 3: Use `verifyRequest()` for dual-mode auth in edge functions

```typescript
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';
const authResult = await verifyRequest(req);
if (isVerifyError(authResult)) {
  return new Response(JSON.stringify({ error: authResult.error }), {
    status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
const { mode, agencyId, staffUserId, userId, isManager } = authResult;
```

Exceptions: admin-only functions (JWT-only OK), staff-specific functions (direct header validation OK).

**CRITICAL**: `verifyRequest()` tries JWT first, then falls back to staff session. This is intentional — `supabase.functions.invoke` always auto-sends `Authorization: Bearer <anon_key>` even for staff users with no Supabase auth session. Never change `verifyRequest` to skip the staff session fallback when JWT fails. If you need to modify the auth priority logic, run the `verifyRequest` integration test first (`src/tests/verifyRequest-auth-fallback.test.ts`).

### Rule 3b: ALWAYS pass JWT explicitly to `getUser()`

```typescript
const jwt = authHeader.replace("Bearer ", "");
const { data: { user } } = await userClient.auth.getUser(jwt); // CORRECT
// getUser() without arg returns null in throwaway edge function clients
```

### Rule 4: Staff portal uses `useStaffAuth()`, not `useAuth()`

- `useAuth().user.id` → `auth.users.id` (owners/admins only)
- `useStaffAuth().user.id` → `staff_users.id` (staff only)
- Dual-portal components: accept user ID as prop

### Rule 5: New tables tracking users MUST support staff

```sql
created_by_user_id uuid REFERENCES auth.users(id),
created_by_staff_id uuid REFERENCES staff_users(id),
CONSTRAINT must_have_creator CHECK (created_by_user_id IS NOT NULL OR created_by_staff_id IS NOT NULL)
```

## SECURITY DEFINER RPC Patterns

### Deny-by-default auth branching

```sql
IF auth.uid() IS NOT NULL THEN
  -- JWT path: has_agency_access(auth.uid(), p_agency_id)
ELSIF p_staff_session_token IS NOT NULL THEN
  -- Staff path: verify_staff_session(p_staff_session_token, p_agency_id)
ELSE
  RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
END IF;
```

Never return data based only on `p_agency_id` input.

### Enum-safe comparisons

```sql
lower(coalesce(tm.status::text, '')) = 'active'  -- SQL
```
```ts
.eq('status', 'active')                           // Supabase JS
```

Never use `'Active'` (wrong case). Always cast enum to text before coalesce.

### Function privilege changes

Keep REVOKE+GRANT adjacent in same migration:

```sql
REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ... TO authenticated;
GRANT EXECUTE ON FUNCTION ... TO anon;
```

### Post-deploy requirement

After any auth/RLS/RPC change, run cross-agency tamper tests (same-agency expect 200, different-agency expect 401/403) before marking complete.

## Call Scoring Credit Limits (MANDATORY — production outages 2026-03-09)

Two call scoring systems (OLD: `agency_call_scoring_settings` + `call_usage_tracking`, NEW: `agency_call_balance`) must stay in sync. Admin UI writes to both on save.

### Rule 1: NEVER hardcode call limits in display code

```typescript
// WRONG — shows "200/20" for coaching clients:
const subLimit = subscription?.isActive ? 20 : subscription?.isTrialing ? 3 : 0;

// CORRECT — reads actual limit from agency_call_balance:
const subLimit = callBalance.subscriptionLimit || 0;
```

Limits are dynamic: 200 for coaching clients, 50/100 for Call Scoring tiers, 20 for standard Boardroom. Always use `callBalance.subscriptionLimit` from `useCallBalance` hook.

### Rule 2: Stripe webhook renewal MUST NOT overwrite `subscription_calls_limit`

`handleSubscriptionRenewal` resets `subscription_calls_used = 0` only. Never set `subscription_calls_limit` — it destroys admin-configured limits.

### Rule 3: Admin save syncs to both systems

`AdminAgencyCallScoring.tsx` → writes `calls_limit` to `agency_call_scoring_settings` AND `subscription_calls_limit` to `agency_call_balance`. Never break this sync.

## Date/Timezone Rule (MANDATORY — recurring production bug)

**NEVER** use `.toISOString().split('T')[0]` or `.toISOString().slice(0, 10)` to extract a date string from a Date object created in local time. This converts to UTC first, which shifts dates backward by one day in all US timezones (after ~7 PM ET / ~4 PM PT).

```typescript
// WRONG — returns yesterday's date after 7 PM ET:
const dateStr = new Date().toISOString().split('T')[0];
const dateStr = new Date(year, month, 1).toISOString().slice(0, 10);
const dateStr = someLocalDate.toISOString().split('T')[0];

// CORRECT — uses browser local timezone:
import { format } from 'date-fns';
const dateStr = format(new Date(), 'yyyy-MM-dd');
const dateStr = format(new Date(year, month, 1), 'yyyy-MM-dd');
const dateStr = format(someLocalDate, 'yyyy-MM-dd');
```

**Exception 1**: `.toISOString()` is fine for full timestamps (`updated_at`, `created_at`, etc.) where you need the complete ISO string — the bug only applies when extracting the date portion.

**Exception 2**: `.toISOString().split('T')[0]` is correct for Date objects at **UTC midnight** from DB date strings (`new Date('2026-03-15')`) or xlsx parsing. Using `format()` on these would shift backward. See `useWinbackBackgroundUpload.ts` and `sendToWinback.ts` for examples. When in doubt about the origin, use `format()` — it's safer for the common case.

**Edge functions (Deno)**: Use `new Intl.DateTimeFormat("en-CA", { timeZone: agencyTz }).format(new Date())` since date-fns isn't available.

## Cross-Cutting Gotchas

- Call scoring output contract must stay consistent across analyzer, UI, and email.
  - Never map RAPPORT display text from generic `primary_focus` first.
  - For sales corrective plan, always route by section intent (`rapport`, `value_building`, `closing`) and keep `primary_focus/secondary_focus/closing_focus` as compatibility aliases only.
  - Talk-to-listen ratios must be derived from seconds (`agent_talk_seconds`, `customer_talk_seconds`, `dead_air_seconds`) in both UI and email; do not let one path use stale percentages while the other uses seconds.
  - Section detail rendering must preserve `STRENGTHS/GAPS/ACTION`; if model returns partial fields, synthesize detail from section data instead of dropping to tip-only output.
  - Do not assume sales section keys for service calls in shared scorecard UI (service uses section arrays and different names).
- `sale_policies` column is `policy_type_name`, NOT `policy_type` — wrong name silently kills PostgREST nested selects
- Always verify PostgREST nested select column names against `src/integrations/supabase/types.ts`
- Fire-and-forget edge functions swallow errors — always test end-to-end after changes
- Duplicate migration timestamps cause `supabase db push` PK conflicts on `schema_migrations`
- `include_in_metrics` filters in RPC functions but NOT in `vw_metrics_with_team` view
- All scheduled email functions MUST have a GitHub Actions cron trigger (never external cron)
- Email functions MUST use `Intl.DateTimeFormat` for timezone, NOT hardcoded UTC offsets
- Must use Resend batch API (`/emails/batch`), NOT single endpoint with `to: [array]`
- Cron spanning midnight UTC must NOT filter by day-of-week in cron — filter inside function using local timezone
- Cron email functions must use a 2-hour window (e.g. `localHour === 19 || localHour === 20`), NOT exact hour match — GitHub Actions skips cron runs unpredictably. Use `email_send_log` table dedup to prevent double-sends.
- `onSuccess` callbacks that write metrics data MUST invalidate `['dashboard-daily']` query cache

## Hybrid Role Rules (MANDATORY — deployed 2026-03-15, live 2026-03-22)

Hybrid is a standalone scorecard role with its own metrics, form, and dashboard tab. It is NOT a combination of Sales + Service.

### Rule 1: metrics_daily has TWO role columns

- `role` — the team member's role at submission time (who they ARE)
- `scoring_role` — which role's scorecard rules scored the day (how they were SCORED)

For non-Hybrid members: `role` = `scoring_role` (always the same). For Hybrid members: `scoring_role` is resolved from `form_templates.role` by the AFTER trigger `recalculate_metrics_hits_pass`.

### Rule 2: Dashboard filtering by role

- **Sales/Service tabs**: filter by `role` column (`role.eq.Sales,role.eq.Hybrid` or `role.eq.Service,role.eq.Hybrid`) — existing behavior, includes Hybrid members
- **Hybrid tab**: filter by `scoring_role` column (`scoring_role.eq.Hybrid`) — only Hybrid-scored work
- **Main dashboard** (`AgencyMetricRings`): Hybrid members use `role='All'` to find data regardless of historical `role` values
- **NEVER** use `scoring_role` for Sales/Service tabs — it breaks when Hybrid members have historical data under different roles

### Rule 3: ONE metrics_daily row per member per day

Multiple form submissions on the same day overwrite the same row (ON CONFLICT). The last submission wins. This is by design — do not try to create multiple rows per day.

### Rule 4: KPI loading for Hybrid must show ALL KPIs

When loading KPIs for Hybrid role (settings, form builder, labels), skip the `role.eq.${role},role.is.null` filter. Hybrid needs access to Sales-role, Service-role, AND null-role KPIs. Pattern: `if (role && role !== 'Hybrid') { query = query.or(...); }`

### Rule 5: Dashboard-tracked metrics on form submission

Only show dashboard-tracked metrics (Quoted Households, Items Sold) if they are enabled in the form's role's `scorecard_rules.selected_metrics`. Do NOT fall back to `hasQuotedTarget` or `dashboardQuotedCount` — those are role-agnostic and leak Sales metrics into Service/Hybrid forms.

### Rule 6: Multi-form finalization is scoped by form_template_id

The "clear finals" step in `staff_submit_form` and `submit_public_form` must include `.eq('form_template_id', sRow.form_template_id)`. Without this, the last form submitted on a given day clears ALL previous finals for that member+date, even from different form types.

### Rule 7: Date-gated changes activate March 22, 2026

Three UI changes are gated by `format(new Date(), 'yyyy-MM-dd') >= '2026-03-22'`:
- `StaffSubmitWrapper.tsx` — Hybrid members only see Hybrid forms
- `Agency.tsx` — hybrid_team_assignments checkboxes hidden
- `AdminTeam.tsx` — same checkboxes + label hidden

After the date passes and behavior is confirmed, these date checks can be replaced with permanent logic.

### Key files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260315100000_seed_hybrid_scorecard_rules.sql` | Seeds Hybrid rules, fixes KPI loading RPC |
| `supabase/migrations/20260316100000_hybrid_dashboard_read_paths.sql` | scoring_role column, view update, RPC update |
| `src/components/staff/StaffSubmitWrapper.tsx` | Form visibility — date-gated Hybrid lockdown |
| `src/pages/Settings.tsx` | Hybrid scorecard rules configuration |
| `src/pages/MetricsDashboard.tsx` | Hybrid dashboard tab |
| `src/pages/StaffFormSubmission.tsx` | Dashboard-tracked metrics scoping |
| `src/components/dashboard/AgencyMetricRings.tsx` | Main dashboard — role=All for Hybrid |
| `supabase/functions/get_dashboard_daily/index.ts` | scoring_role filter for Hybrid tab |
| `supabase/functions/get_member_month_snapshot/index.ts` | Per-day calendar scoring_role |

## Brand Colors

- Dark gray blue: `#1e283a`
- Dark blue: `#020817`
- Gray: `#60626c`
- Vivid red: `#af0000`

Use these consistently across all UI components. Do not introduce new brand colors without explicit approval.

## Database Rules

See `supabase/CLAUDE.md` for detailed rules on: `metrics_daily`, `lqs_households`, sales emails, and migration safety.

## Historical Decisions

See `docs/DECISIONS.md` for: access hardening reports (2026-02-08), Monday morning runbook, GIC implementation plan.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Rules

- **NEVER fabricate, assume, or invent information.** If you don't know something, say "I don't know." If you're uncertain, say "I'm not sure." Never state speculation as fact. Never invent explanations for data you haven't verified. This applies to all responses — code, data, debugging, and conversation.
- **After fixing any production bug**, update this file with a rule that prevents the same class of bug from recurring. Include: what went wrong, the correct pattern (with code examples), and which files/functions the rule applies to.
- **After creating or modifying a function** that writes to a table with constraints or triggers, check this file for existing rules about that table and follow them exactly.
- **Never re-create a function from scratch** without first reading the current deployed version and preserving all protective patterns (GREATEST, COALESCE, exception handlers, required columns). Copy the existing function and modify it — do not write from memory.

## Project Overview

AgencyBrain is a production-ready insurance agency management platform. It's a multi-tenant SaaS application with sales tracking, training, compensation analysis, and staff management features.

**Tech Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL + Edge Functions)

## Development Commands

```bash
npm run dev          # Start dev server (localhost:8080)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest unit tests
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright E2E tests
```

Run a single test file:
```bash
npx vitest run src/tests/your-test.test.ts
```

Run tests matching a pattern:
```bash
npx vitest run -t "pattern"
```

## Architecture

### Data Flow
```
React Components → React Query hooks → Supabase SDK → Edge Functions → PostgreSQL (RLS)
```

### Key Directories
- `src/components/` - 424 React components, including `ui/` for shadcn/ui
- `src/pages/` - Route-level pages (`admin/`, `agency/`, `staff/`)
- `src/hooks/` - 127 custom React hooks
- `src/lib/` - Core utilities (`auth.tsx`, `supabaseClient.ts`, `utils.ts`)
- `src/config/navigation.ts` - Hierarchical navigation with role-based access
- `supabase/functions/` - 113 Deno edge functions
- `supabase/migrations/` - 548 database migrations

### State Management
- **AuthProvider** (`src/lib/auth.tsx`): User session and roles
- **Zustand**: Global stores (bonus grid state, chat persistence)
- **React Query**: Server state and caching

### Multi-Tenant Security
- All data is agency-scoped via Row-Level Security (RLS) policies
- User roles: admin, agency owner, key employee, staff
- Edge functions use `SECURITY INVOKER` (run with caller privileges)
- `has_agency_access(auth.uid(), agency_id)` validates access in RLS policies

### Public Form System
- Token-based access without authentication
- Edge functions: `submit_public_form`, `resolve_public_form`
- Versioned KPI tracking (`kpi_versions`, `forms_kpi_bindings`)

## CI/CD

Deployments are gated by GitHub Actions (`.github/workflows/edge-deploy-gates.yml`):

- **Gate A** (blocking): Verify functions on disk match `supabase/config.toml`
- **Gate B** (non-blocking): Resolve function schema validation
- **Gate C** (non-blocking): KPI smoke test

Edge functions auto-deploy to Supabase on push to `main`.

## Database Conventions

- All tables have RLS policies enforcing agency isolation
- Use `FOR SELECT` for read-only dashboard queries
- Never use `SECURITY DEFINER` without explicit justification
- Migrations in `supabase/migrations/` are versioned and reversible
- Never use duplicate migration timestamps — `supabase db push` will fail with a PK conflict on `schema_migrations`

## Staff & Multi-Role Access Rules (MANDATORY — read before touching RLS, edge functions, or auth)

This codebase has **four user types** with different auth mechanisms. Every RLS policy, edge function, and frontend component must account for all of them. These rules exist because production bugs have repeatedly occurred when new code only checks `profiles`.

### User Types and Auth Mechanisms

| User Type | Auth Method | ID Source | Agency Resolution |
|-----------|------------|-----------|-------------------|
| Admin | Supabase JWT | `auth.users.id` → `profiles.id` | `profiles.role = 'admin'` (all agencies) |
| Agency Owner | Supabase JWT | `auth.users.id` → `profiles.id` | `profiles.agency_id` |
| Key Employee | Supabase JWT | `auth.users.id` → `profiles.id` + `key_employees.user_id` | `key_employees.agency_id` |
| Staff User | `x-staff-session` header OR `session_token` in body | `staff_users.id` (NOT in `auth.users`) | `staff_users.agency_id` |

### Rule 1: ALWAYS use `has_agency_access()` in RLS policies

Every RLS policy that checks agency membership **MUST** use `has_agency_access(auth.uid(), agency_id)`. This function already handles all four user types.

```sql
-- CORRECT:
CREATE POLICY "my_table_select" ON my_table
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

-- WRONG — blocks key employees and staff:
CREATE POLICY "my_table_select" ON my_table
  FOR SELECT USING (
    agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  );

-- WRONG — same problem, different syntax:
CREATE POLICY "my_table_select" ON my_table
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.agency_id = my_table.agency_id)
  );
```

**Why:** The `profiles` table only contains admins and agency owners. Key employees are in `key_employees`, and staff users are in `staff_users` with a `linked_profile_id`. Direct `profiles` checks silently exclude 2 of 4 user types.

**NEVER** write `FROM profiles WHERE id = auth.uid()` in any RLS policy. If you see this pattern in existing code, it is a bug — fix it.

### Rule 2: Edge functions MUST use `_shared/cors.ts` or include staff headers

Every edge function **MUST** either:
1. Import `corsHeaders` from `../_shared/cors.ts` (preferred), OR
2. Include `x-staff-session, x-staff-session-token` in its inline `Access-Control-Allow-Headers`

```typescript
// CORRECT — import shared CORS:
import { corsHeaders } from '../_shared/cors.ts';

// CORRECT — inline with staff headers:
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session, x-staff-session-token',
};

// WRONG — missing staff session headers (browser preflight will reject):
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Exception:** Functions that are genuinely pre-auth (e.g., `staff_request_password_reset`, `resolve_public_form`) and will never receive a staff session header may omit it, but prefer including it for consistency.

### Rule 3: Edge functions that need auth MUST use `verifyRequest()` for dual-mode support

Any edge function that checks who the caller is **MUST** use the `verifyRequest()` helper from `_shared/verifyRequest.ts`. This handles both JWT auth (owners/admins) and staff session auth in one call.

```typescript
// CORRECT:
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';
const authResult = await verifyRequest(req);
if (isVerifyError(authResult)) {
  return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const { mode, agencyId, staffUserId, userId, isManager } = authResult;

// WRONG — blocks all staff users:
const { data: { user } } = await supabase.auth.getUser();
```

**Exception:** Admin-only functions (`admin-create-user`, `admin-delete-user`) may use JWT-only auth since staff should never call them. Staff-specific functions (`staff_add_quote`, `staff_submit_form`) that use `x-staff-session` header validation directly are also fine.

### Rule 3b: ALWAYS pass JWT explicitly to `getUser()` in edge functions

In `_shared/verifyRequest.ts` and any edge function that validates a JWT, **ALWAYS** pass the token explicitly:

```typescript
// CORRECT — passes JWT directly, works regardless of gotrue-js version:
const jwt = authHeader.replace("Bearer ", "");
const { data: { user }, error } = await userClient.auth.getUser(jwt);

// WRONG — relies on session state, which is empty in edge function throwaway clients:
const { data: { user }, error } = await userClient.auth.getUser();
```

**Why:** Edge functions create fresh Supabase clients per request with no signed-in session. In newer `gotrue-js` versions, `getUser()` without a parameter checks for a stored session first — finds none — and returns `{ user: null }` without ever validating the JWT against the Auth API. This caused a production outage (2026-02-13) where all Growth Center uploads failed with "Invalid or expired JWT" after a routine edge function redeployment resolved a newer `gotrue-js` patch via `esm.sh`.

**Applies to:** `_shared/verifyRequest.ts` and any edge function that creates a Supabase client and calls `auth.getUser()`.

### Rule 4: Frontend components MUST NOT use `useAuth().user.id` for staff-facing features

Components rendered in the staff portal (`/staff/*`) must use `useStaffAuth()`, not `useAuth()`. The IDs come from different tables:

- `useAuth().user.id` → `auth.users.id` (only for owners/admins)
- `useStaffAuth().user.id` → `staff_users.id` (for staff)

If a component needs to work in both portals, accept the user ID as a prop instead of calling either hook directly.

### Rule 5: New tables with `user_id` columns MUST support staff

When creating a table that tracks who performed an action:

```sql
-- CORRECT — dual reference pattern:
created_by_user_id uuid REFERENCES auth.users(id),
created_by_staff_id uuid REFERENCES staff_users(id),
CONSTRAINT must_have_creator CHECK (created_by_user_id IS NOT NULL OR created_by_staff_id IS NOT NULL)

-- WRONG — staff operations will get FK violations:
user_id uuid NOT NULL REFERENCES auth.users(id)
```

## metrics_daily Rules (MANDATORY — read before touching any metrics code)

The `metrics_daily` table is written to by **multiple independent paths** (scorecard submissions, dashboard "Add Quote" button, call sync triggers, sales sync triggers). These rules exist because production bugs have occurred when they were violated.

### Rule 1: GREATEST() on quoted_count and sold_items

Any function that writes to `metrics_daily` via `ON CONFLICT ... DO UPDATE` **MUST** use `GREATEST()` for `quoted_count` and `sold_items`:

```sql
-- CORRECT:
quoted_count = GREATEST(COALESCE(metrics_daily.quoted_count, 0), EXCLUDED.quoted_count),
sold_items   = GREATEST(COALESCE(metrics_daily.sold_items, 0), EXCLUDED.sold_items),

-- WRONG — will overwrite trigger-incremented values back to 0:
quoted_count = EXCLUDED.quoted_count,
sold_items   = EXCLUDED.sold_items,
```

**Why:** The `lqs_households` trigger increments `quoted_count` when a quote is added from the dashboard. If a scorecard submission later runs `upsert_metrics_from_submission`, a plain `= EXCLUDED.quoted_count` overwrites the trigger's increment. `GREATEST()` preserves whichever value is higher.

**Applies to:** `upsert_metrics_from_submission`, `sync_call_metrics_to_metrics_daily`, `sync_lqs_sales_to_metrics_daily`, and any future function that upserts into `metrics_daily`.

### Rule 2: kpi_version_id and label_at_submit are required

Every INSERT into `metrics_daily` **MUST** include `kpi_version_id` and `label_at_submit`. There is a CHECK constraint (`md_version_fields_nonnull`) that will reject rows without them.

```sql
-- Look up a valid kpi_version for the agency:
SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
FROM kpi_versions kv
JOIN kpis k ON k.id = kv.kpi_id
WHERE k.agency_id = <agency_id> AND kv.valid_to IS NULL
ORDER BY kv.valid_from DESC LIMIT 1;

-- Fallback via form bindings if direct lookup fails:
SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
FROM forms_kpi_bindings fb
JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
JOIN form_templates ft ON ft.id = fb.form_template_id
WHERE ft.agency_id = <agency_id> AND kv.valid_to IS NULL
ORDER BY fb.created_at DESC LIMIT 1;
```

If no kpi_version is found, **skip the INSERT** and log a warning — do not insert with NULL values.

### Rule 3: KPI extraction must handle ALL slugs, not just custom

When extracting KPI values from form schemas in `upsert_metrics_from_submission`, the loop over `form_schema->'kpis'` must process **all** KPI types:

- `custom_%` slugs → store in `custom_kpis` JSONB column
- Standard slugs (`outbound_calls`, `quoted_households`, `items_sold`, etc.) → route to the corresponding column variable (`oc`, `qc`, `si`, etc.)

**Never** add `IF v_selected_kpi_slug NOT LIKE 'custom_%' THEN CONTINUE;` — this silently drops standard KPIs that are mapped via `custom_kpi_*` field keys, causing them to extract as 0.

### Rule 4: NEVER compute hits/pass from form payload values

Any function that computes `hits`, `pass`, or `daily_score` **MUST** use the actual stored values in `metrics_daily`, NOT values extracted from the form payload. Form payload values are pre-GREATEST — the actual stored `quoted_count` and `sold_items` may be higher due to dashboard adds or sync triggers.

```sql
-- WRONG — computes hits from form payload, which may be 0 even though DB has 6:
qc := _nz_int(s.p->'quoted_households');  -- form says 0
-- ... later ...
IF qc >= nreq THEN hits := hits + 1; END IF;  -- 0 >= 3 = false (WRONG)
-- ... but GREATEST stores 6 in the DB:
quoted_count = GREATEST(COALESCE(metrics_daily.quoted_count, 0), EXCLUDED.quoted_count)

-- CORRECT — the AFTER trigger recalculates from stored values automatically.
-- Do NOT try to compute hits/pass inline. The trigger handles it.
```

**Why:** `upsert_metrics_from_submission` applies `GREATEST()` in the ON CONFLICT clause, but it computed `hits`/`pass` *before* the upsert using the raw form values. If the DB already had `quoted_count=6` from dashboard adds and the form sent `0`, the DB correctly stored `6` but `pass` was calculated from `0`.

**Current protection:** The AFTER trigger `trg_metrics_daily_recalc_hits_pass` on `metrics_daily` (migration `20260206120000`) automatically recalculates `hits`/`pass`/`daily_score` from stored values whenever metric columns change. This covers all write paths. **Do not remove or disable this trigger.**

### Rule 5: Pass threshold MUST use `scorecard_rules.n_required`, NOT `array_length(selected_metrics)`

When determining whether a team member passed, **ALWAYS** use `scorecard_rules.n_required` (default 2):

```sql
-- CORRECT — matches dashboard display:
v_pass := (v_hits >= COALESCE(rules.n_required, 2));

-- WRONG — requires ALL metrics to hit, but agencies configure n_required for a reason:
v_pass := (v_hits >= array_length(rules.selected_metrics, 1));
```

**Why:** `upsert_metrics_from_submission` used `array_length(sel, 1)` which required ALL selected metrics to pass (e.g., 4/4). But the dashboard (`get_dashboard_daily`) uses `n_required` (e.g., 2). This caused the dashboard to show pass while the calendar showed fail for the same day. The `recalculate_metrics_hits_pass` function and trigger now correct this.

**Applies to:** `recalculate_metrics_hits_pass`, `upsert_metrics_from_submission`, and any future function that computes `pass`.

### Rule 6: onSuccess callbacks must invalidate cache

Any modal or form that writes data affecting `metrics_daily` (e.g., `AddQuoteModal`) **must** call `queryClient.invalidateQueries({ queryKey: ['dashboard-daily'] })` in its `onSuccess` callback. Never use `onSuccess={() => {}}`.

## lqs_households Rules (MANDATORY — read before touching LQS data or writing cleanup migrations)

The `lqs_households` table is the **single source of truth** for the LQS Roadmap pipeline (`lead` → `quoted` → `sold`). The Contacts page also derives lifecycle stages from this table. These two systems MUST stay in sync. These rules exist because a cleanup migration deleted legitimate data and broke the LQS Roadmap.

### Rule 1: NEVER DELETE lqs_households rows in bulk without checking for linked contacts

Any migration that deletes `lqs_households` rows **MUST** first verify those rows are not the only record keeping a contact visible in the LQS pipeline.

```sql
-- WRONG — deletes legitimate open leads, breaks LQS Roadmap:
DELETE FROM lqs_households
WHERE status = 'lead'
  AND NOT EXISTS (SELECT 1 FROM lqs_quotes q WHERE q.household_id = lqs_households.id)
  AND NOT EXISTS (SELECT 1 FROM lqs_sales s WHERE s.household_id = lqs_households.id);

-- CORRECT — only delete if no linked contact depends on this record:
DELETE FROM lqs_households h
WHERE h.status = 'lead'
  AND h.contact_id IS NULL                    -- No linked contact
  AND NOT EXISTS (                             -- No contact matched by household_key
    SELECT 1 FROM agency_contacts ac
    WHERE ac.agency_id = h.agency_id AND ac.household_key = h.household_key
  )
  AND NOT EXISTS (SELECT 1 FROM lqs_quotes q WHERE q.household_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM lqs_sales s WHERE s.household_id = h.id);
```

**Why:** The Contacts page (`get_contacts_by_stage`) LEFT JOINs `lqs_households` on `household_key`. Contacts without a matching `lqs_households` row fall through to `ELSE 'open_lead'` and still appear as "Open Lead" on the Contacts page. But the LQS Roadmap counts `lqs_households.status = 'lead'` directly — if those rows are deleted, the Roadmap shows zero leads while the Contacts page still shows them. This happened in production (migration `20260205220000`, fixed by `20260207070000`).

**Applies to:** Any migration or function that DELETEs from `lqs_households`.

### Rule 2: Contacts and lqs_households must stay synchronized

The two tables derive "Open Lead" status differently:

| System | How it determines "Open Lead" |
|--------|-------------------------------|
| **Contacts page** (`get_contacts_by_stage`) | `lqs_households.status = 'lead'` OR no `lqs_households` row at all (ELSE fallback) |
| **LQS Roadmap** (`useLqsData` hook) | `lqs_households.status = 'lead'` only |

If a contact exists in `agency_contacts` but has **no** corresponding `lqs_households` row, it will show as "Open Lead" on the Contacts page but will be **invisible** on the LQS Roadmap.

**Rule:** Any bulk operation on `lqs_households` (DELETE, status UPDATE) must consider the impact on both systems. If rows are removed, either:
1. Ensure the contacts are no longer relevant (e.g., contact was also deleted), OR
2. Re-create `lqs_households` rows for orphaned contacts

### Rule 3: Cleanup migrations must be scoped, not sweeping

When writing data cleanup migrations:

- **Always scope** by specific `agency_id`, `created_at` range, or other identifying criteria — never clean "all rows matching a status"
- **Always log** what will be affected with a dry-run count before the destructive operation
- **Prefer UPDATE over DELETE** — marking records as inactive is safer than removing them
- **Never assume** `status='lead'` with no quotes means "garbage data" — users can manually add leads via AddLeadModal that legitimately have no quotes yet

## Sales Email Rules (MANDATORY — read before touching sales notification or summary emails)

The sales email system has two edge functions that query the `sales` and `sale_policies` tables. These rules exist because a wrong column name silently broke all sales emails for 5 days (Feb 8–13, 2026).

### Rule 1: sale_policies column is `policy_type_name`, NOT `policy_type`

The `sale_policies` table column for the policy type display name is **`policy_type_name`**. There is no column called `policy_type`.

```typescript
// CORRECT:
sale_policies(policy_type_name)

// WRONG — causes PostgREST error, silently kills the entire query:
sale_policies(policy_type)
```

**Why:** PostgREST returns an error when you select a non-existent column from a nested resource. Because both `send-sale-notification` and `send-daily-sales-summary` are called fire-and-forget, the error is silently swallowed and no email is ever sent.

**Applies to:** `supabase/functions/send-sale-notification/index.ts`, `supabase/functions/send-daily-sales-summary/index.ts`, and any future function that queries `sale_policies`.

### Rule 2: ALWAYS verify PostgREST nested select column names against actual schema

Before adding or modifying a `.select()` call that includes nested resource columns (e.g., `sale_policies(col)`, `lead_sources(col)`), verify the column name exists in the actual table by checking `src/integrations/supabase/types.ts` or the migration that created the table. PostgREST nested select errors are silent when the caller is fire-and-forget.

### Rule 3: Sales email functions are fire-and-forget — errors must be logged

Both `send-sale-notification` and `send-daily-sales-summary` are invoked via non-blocking calls (`.catch()` swallows errors). Any error inside these functions is invisible to the user. When modifying these functions:
- Always test the full invocation path end-to-end after changes
- Never assume a successful deploy means the function works — the query may fail at runtime

### Key column reference for sales email queries

| Table | Column | Purpose |
|-------|--------|---------|
| `sale_policies` | `policy_type_name` | Display name of the policy type (e.g., "Renters", "Homeowners") |
| `sale_policies` | `product_type_id` | FK to `policy_types` table (nullable) |
| `sales` | `total_policies` | Count of policies in the sale |
| `sales` | `total_items` | Count of line items in the sale |
| `sales` | `total_premium` | Total premium amount |

## Testing

- **Vitest**: Unit tests with jsdom, setup in `src/tests/setup.ts`
- **Playwright**: E2E tests in `src/tests/e2e/`
- Supabase client is auto-mocked in tests

Test locations:
- `src/tests/` - Main test directory (security, edge functions, integration)
- `src/tests/e2e/` - Playwright E2E tests
- `src/utils/*.test.ts` - Unit tests co-located with utilities

## Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json` and `vite.config.ts`)

## 2026-02-08 Access Hardening Report (Production)

This section documents a production security/access incident and the exact remediation applied on February 8, 2026.

### Executive Summary

A role/access audit confirmed that tenant-bound data RPCs had inconsistent caller verification across JWT users (owners/admins) and staff-session users. This created a real cross-agency exposure path in at least one RPC (`check_and_reset_call_usage`) and a reliability bug in staff-facing coaching endpoints.

All identified high-priority issues in scope were patched and validated in production.

### What Went Wrong

1. **Dual auth models were not enforced consistently inside SECURITY DEFINER RPCs**
- Architecture is intentional:
  - JWT auth + RLS for owner/admin/key employee paths
  - `staff_sessions` token model for staff portal paths
- Some privileged RPCs accepted tenant IDs from input but did not always enforce caller/agency alignment with deny-by-default branching.

2. **Cross-agency access hole in `check_and_reset_call_usage`**
- A live tamper test using Josh's JWT + another agency UUID returned `HTTP 200` and usage payload.
- Root cause: function signature/logic allowed agency_id-driven lookup without strict caller-to-agency authorization in the hardened model.

3. **Enum mismatch caused runtime failures (`app_member_status`)**
- Some app and SQL filters used `'Active'`/empty-string coercion against enum `app_member_status` (`'active'|'inactive'`).
- This produced `22P02 invalid input value for enum app_member_status` errors in coaching/team-member paths.

4. **UI ownership boundary regression**
- Coaching thresholds editor was exposed on agency `Call Scoring` page.
- Requirement is admin-only configuration under Admin Call Scoring.

### Correct Pattern (Mandatory)

#### Pattern A: Deny-by-default auth branching in privileged RPCs

```sql
IF auth.uid() IS NOT NULL THEN
  -- JWT caller path: must pass has_agency_access(auth.uid(), p_agency_id)
ELSIF p_staff_session_token IS NOT NULL THEN
  -- Staff token path: must pass verify_staff_session(p_staff_session_token, p_agency_id)
ELSE
  RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
END IF;
```

Never allow data return based only on `p_agency_id` input.

#### Pattern B: Shared staff-session helper (no duplicated auth SQL)

```sql
CREATE OR REPLACE FUNCTION public.verify_staff_session(p_token text, p_agency_id uuid)
RETURNS uuid ...
```

Use this helper inside every staff-capable SECURITY DEFINER RPC.

#### Pattern C: Enum-safe comparisons

For enum/text comparisons, always cast enum to text first:

```sql
lower(coalesce(tm.status::text, '')) = 'active'
```

And in Supabase JS, use exact enum value:

```ts
.eq('status', 'active')
```

Never use `'Active'` and never rely on `coalesce(enum_col, '')` without casting.

#### Pattern D: Public execute grants must be explicit and adjacent

When changing function privileges:

```sql
REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ... TO authenticated;
GRANT EXECUTE ON FUNCTION ... TO anon;
```

Keep REVOKE+GRANT adjacent in the same migration/transaction.

### Production Fixes Applied

#### Database migrations

- `20260208143000_harden_staff_rpc_auth_phase1.sql`
  - Added shared helper `public.verify_staff_session(text, uuid)`.
  - Hardened RPCs with deny-by-default auth flow and staff-token support:
    - `public.get_staff_call_scoring_data(...)`
    - `public.get_staff_call_details(...)`
    - `public.is_call_scoring_enabled(...)`
    - `public.get_agency_settings(...)`
    - `public.get_staff_call_status(...)`
    - `public.get_staff_call_metrics(...)`
    - `public.get_agency_call_metrics(...)`
  - Applied explicit REVOKE/GRANT execute privileges for hardened signatures.

- `20260208144500_harden_check_call_usage_auth.sql`
  - Replaced `check_and_reset_call_usage` with strict auth validation:
    - JWT path uses `has_agency_access`
    - staff token path uses `verify_staff_session`
    - else unauthorized

- `20260208150000_fix_staff_call_scoring_enum_cast.sql`
  - Fixed enum/text coercion in:
    - `public.verify_staff_session(...)`
    - `public.get_staff_call_scoring_data(...)`

#### App/UI changes

- `src/pages/CallScoring.tsx`
  - Removed coaching-threshold editor from agency Call Scoring.
  - Added legacy tab-state cleanup so old `coaching` tab state does not dead-end.

- `src/pages/admin/CallScoringTemplates.tsx`
  - Added admin-only `Coaching Thresholds` tab.
  - Added agency selector + mounted `CoachingThresholdsSettings` there.

- `src/hooks/useCoachingInsights.ts`
  - Fixed enum value filters from `'Active'` to `'active'`.

### Validation Evidence (Production)

Tamper tests run against production (`wjqyccbytctqwceuhzhk`) showed:

1. `check_and_reset_call_usage`
- Cross-agency request: `403 unauthorized` (PASS)
- Same-agency request: `200` with usage payload (PASS)

2. `is_call_scoring_enabled`
- Cross-agency: `403 unauthorized` (PASS)
- Same-agency: `200 true` (PASS)

3. `get_agency_settings`
- Cross-agency: `403 unauthorized` (PASS)
- Same-agency: `200` payload (PASS)

4. `get_staff_call_scoring_data`
- Cross-agency: `403 unauthorized` (PASS)
- Same-agency: `200` payload (PASS)

5. UI behavior checks
- Agency owner can access Coaching Insights page (PASS)
- Agency Call Scoring no longer exposes thresholds editor (PASS)
- Admin Call Scoring exposes admin-only thresholds editor (PASS)

### Residual Risks

1. Remaining SECURITY DEFINER RPCs outside phase-1 may still contain inconsistent auth patterns.
2. Lovable preview can show noisy auth-bridge/CORS console errors unrelated to data-path auth; treat as environment noise unless RPC responses fail.
3. Manual SQL hotfixes are high risk unless immediately codified in migrations (done here).

### Release Gate: Access-Safety Checklist (Mandatory before merge/deploy)

1. For each changed privileged RPC, run a two-sided test:
- same caller + same agency => expect 200
- same caller + different agency => expect 401/403

2. Verify no enum literal mismatches:
- `app_member_status` must be `'active'|'inactive'` only

3. Verify function privilege changes:
- REVOKE and GRANT present and adjacent

4. Verify staff+JWT parity:
- JWT caller works
- staff token caller works
- unauthenticated caller denied

5. Verify UI role boundaries:
- Admin-only settings do not appear on owner/staff pages

### Applies To (Do Not Ignore)

- SQL functions in `supabase/migrations/*` that define or modify SECURITY DEFINER RPCs.
- App hooks/components that query `team_members.status`:
  - `src/hooks/useCoachingInsights.ts`
- Call-scoring/coaching access surfaces:
  - `src/pages/CallScoring.tsx`
  - `src/pages/admin/CallScoringTemplates.tsx`

### Non-Negotiable Rule Added

After any auth/RLS/RPC change, do not treat deployment as complete until cross-agency tamper tests are executed and logged with status codes for both deny/allow paths.

## Security Hardening Report (2026-02-08) - Phase 2 + Edge Auth Standardization

### Executive Summary

Phase 2 was implemented and deployed to production to reduce cross-agency access risk in subscription/call-balance pathways while preserving normal same-agency access.  
Result: tested deny/allow paths are behaving correctly in production (`403` cross-agency, `200` own-agency), and known coaching-insights loading failures caused by enum mismatch were fixed.

### What Was Changed

#### Database Migrations (Applied to Production)

1. `supabase/migrations/20260208150000_fix_staff_call_scoring_enum_cast.sql`
- Fixed enum-cast/status handling for staff call-scoring queries.
- Removed error path `invalid input value for enum app_member_status`.

2. `supabase/migrations/20260208153000_phase2_harden_subscription_call_balance_access.sql`
- Hardened access checks for subscription and call-balance domains.
- Updated RLS and/or function guardrails to consistently enforce agency-bound authorization.
- Added explicit function execution boundaries for privileged service-role flows where required.

#### Edge Function Auth Standardization (Committed + Pushed)

Commit: `a2be58a4` on `main`

Updated:
- `supabase/functions/purchase-call-pack/index.ts`
- `supabase/functions/save-report/index.ts`
- `supabase/functions/roleplay-config/index.ts`

Key changes:
- Standardized request verification via shared `verifyRequest` utility.
- Enforced clear deny-by-default behavior for invalid or missing auth context.
- Removed inconsistent ad-hoc auth handling where possible.
- Kept roleplay token access behavior compatible while tightening authenticated/staff session handling.

### Production Validation Evidence

#### Phase 1/2 Access Tamper Tests (Production RPC)

Using Josh token against production:

1. `check_feature_access`
- Cross-agency (`HFI`): `403 unauthorized` (PASS)
- Own-agency (`Josh agency`): `200` with expected access payload (PASS)

2. `check_call_scoring_access`
- Cross-agency (`HFI`): `403 unauthorized` (PASS)
- Own-agency (`Josh agency`): `200` with expected scoring payload (PASS)

3. Prior hardened call-scoring endpoints remained correct:
- `check_and_reset_call_usage` cross `403`, own `200` (PASS)
- `is_call_scoring_enabled` cross `403`, own `200` (PASS)
- `get_agency_settings` cross `403`, own `200` (PASS)
- `get_staff_call_scoring_data` cross `403`, own `200` (PASS)

#### UI/Behavior Validation

- Coaching Insights route loads for authorized owner account (PASS).
- Call Scoring loads correctly after fixes (PASS).
- Save-report flow validated working (PASS).
- Coaching threshold editing remains restricted to admin Call Scoring context (PASS per intended model).

### Why This Reduces Monday-Morning Access Risk

1. Cross-agency access vectors in key subscription/call-balance RPCs now fail closed.
2. Same-agency owner flows are still functional, reducing lockout/regression probability.
3. Auth enforcement in selected edge functions now follows a shared verification model, reducing drift and one-off mistakes.
4. Enum mismatch causing query failures/spinners was patched and deployed.

### Remaining Risk Surface (Still Needs Follow-Through)

1. Not every SECURITY DEFINER RPC in the codebase is covered by the same hardening pass yet.
2. Lovable preview may still show noisy CORS/auth-bridge console errors unrelated to production data auth paths.
3. Any future RPC added with `p_agency_id` and no caller validation can reintroduce cross-tenant risk.

### Monday Morning Runbook

1. Smoke login (owner, admin, staff) and verify dashboard + call scoring load.
2. Execute deny/allow RPC tamper tests:
- `check_feature_access` (cross deny, own allow)
- `check_call_scoring_access` (cross deny, own allow)
3. Confirm coaching insights page renders without enum/status errors.
4. Confirm admin-only threshold controls are only visible in admin call-scoring area.
5. If any 401 appears unexpectedly on own-agency tests, refresh JWT and rerun before escalation.
6. If own-agency still fails after fresh JWT, treat as release blocker and rollback recent auth change set.

### Operational Guardrails (Going Forward)

1. Every new privileged RPC must include explicit caller verification path (`auth.uid()` and/or validated staff token).
2. No RPC should rely on `p_agency_id` alone for authorization.
3. Keep REVOKE/GRANT changes adjacent in the same migration transaction.
4. Require cross-agency tamper test evidence in PR notes before marking auth/security work complete.

## Monday Morning Access Runbook (2026-02-08)

Use this exact sequence after deploy/publish to validate staff + owner access without breaking tenant isolation.

### Scope

- Primary risk domains: staff session auth, SECURITY DEFINER RPC auth, cross-agency isolation.
- Priority UI modules: Winback HQ, Renewals, Cancel Audit, LQS Roadmap, Scorecard Submits, Coaching Insights.
- Environment: production app + production Supabase project.

### Prereqs

1. Fresh owner JWT and/or staff session (do not reuse stale tokens).
2. Two agency IDs available:
- `OWN_AGENCY_ID` (caller agency)
- `CROSS_AGENCY_ID` (different agency)
3. Supabase API URL and anon key available in shell env.

### Step 1: Confirm DB migrations are applied

```bash
cd /Users/justinsmacbook/Projects/agencybrain
supabase migration list
```

Pass criteria:
- New auth-hardening migrations appear on both local and remote lists.

### Step 2: Token freshness check

If RPC tests return `JWT expired` (`PGRST301`), refresh auth by signing in again and re-copy token before continuing.

### Step 3: Core RPC cross-agency tamper tests (must pass)

Set env vars:

```bash
URL="https://<PROJECT_REF>.supabase.co/rest/v1/rpc"
APIKEY="<SUPABASE_ANON_KEY>"
AUTH="<FRESH_JWT_ACCESS_TOKEN>"
OWN_AGENCY_ID="<CALLER_AGENCY_UUID>"
CROSS_AGENCY_ID="<OTHER_AGENCY_UUID>"
```

Run:

```bash
echo "---- check_feature_access cross (expect 401/403)"
curl -i "$URL/check_feature_access" -H "apikey: $APIKEY" -H "Authorization: Bearer $AUTH" -H "Content-Type: application/json" -H "Accept: application/json" --data "{\"p_agency_id\":\"$CROSS_AGENCY_ID\",\"p_feature_key\":\"call_scoring\"}"

echo "---- check_feature_access own (expect 200)"
curl -i "$URL/check_feature_access" -H "apikey: $APIKEY" -H "Authorization: Bearer $AUTH" -H "Content-Type: application/json" -H "Accept: application/json" --data "{\"p_agency_id\":\"$OWN_AGENCY_ID\",\"p_feature_key\":\"call_scoring\"}"

echo "---- check_call_scoring_access cross (expect 401/403)"
curl -i "$URL/check_call_scoring_access" -H "apikey: $APIKEY" -H "Authorization: Bearer $AUTH" -H "Content-Type: application/json" -H "Accept: application/json" --data "{\"p_agency_id\":\"$CROSS_AGENCY_ID\"}"

echo "---- check_call_scoring_access own (expect 200)"
curl -i "$URL/check_call_scoring_access" -H "apikey: $APIKEY" -H "Authorization: Bearer $AUTH" -H "Content-Type: application/json" -H "Accept: application/json" --data "{\"p_agency_id\":\"$OWN_AGENCY_ID\"}"
```

Pass criteria:
- Cross-agency calls: `401` or `403` with unauthorized message.
- Own-agency calls: `200` with valid payload.

### Step 4: Staff-focused RPC checks (must pass)

Run same cross/own pattern for:
- `get_contacts_by_stage`
- `get_dashboard_daily`
- `is_call_scoring_enabled`
- `get_agency_settings`
- `get_staff_call_scoring_data`

Pass criteria:
- Cross-agency denied.
- Own-agency allowed.
- No enum cast errors (especially `app_member_status` invalid input).

### Step 5: UI smoke checks (staff account)

Login as staff on production app and verify:
1. `Contacts` loads rows.
2. `Winback HQ` opens customer panel; adding note succeeds.
3. `Renewals` opens records; activity save succeeds.
4. `Cancel Audit` opens records; note save succeeds.
5. `LQS Roadmap`:
- lead source dropdown populates
- assign lead source succeeds
6. `Scorecard Submits` form submission succeeds.

Pass criteria:
- No blocking errors in UX.
- Console may show non-blocking Radix accessibility warnings; treat as non-security noise unless functionality fails.

### Step 6: UI smoke checks (owner/admin)

1. Owner can use call scoring pages normally.
2. Admin can access admin-only coaching threshold controls.
3. Non-admin users cannot edit admin-only coaching thresholds.

### Release Blockers (stop and rollback if any hit)

1. Own-agency RPC returns unauthorized after token refresh.
2. Cross-agency RPC returns 200.
3. Staff cannot load priority pages (Contacts/LQS/Winback/Renewals/Cancel Audit).
4. Staff note/activity writes fail with FK/auth errors.

### Fast rollback procedure

1. Identify the last known-good commit before the auth/access change.
2. Revert offending commit(s):

```bash
git revert <bad_commit_sha>
git push
```

3. If DB migration caused regression:
- create follow-up migration restoring previous function body/policy/grants.
- push migration:

```bash
supabase db push
```

4. Re-run Steps 3–6 and confirm pass before declaring incident resolved.

### Evidence logging template (required)

For each validation cycle, record:
- Date/time
- Caller identity (role + agency)
- RPC tested
- Cross result (status + message)
- Own result (status + message)
- UI module result (pass/fail + screenshot if fail)
- Commit SHA + migration IDs included

## Growth Intelligence Center (GIC) Implementation Plan (Saved 2026-02-11)

Source of truth:
- `/Users/justinsmacbook/Projects/agencybrain/GROWTH_INTELLIGENCE_CENTER_PLAN_CLAUDE_CODE.md`

Scope:
- Build `Growth Center` for `1:1 Coaching` agencies only.
- Include upload + parse pipeline, analytics tabs, and AI diagnostics.
- Preserve existing AgencyBrain patterns for routing, sidebar access control, hooks, and Supabase edge function conventions.

Execution order (mandatory):
1. Phase 1: Database + Storage setup (manual SQL from Appendix A)
2. Phase 2: Types + hooks + route shell + sidebar item
3. Phase 3: Upload dialog + parse edge function
4. Phase 4: Overview tab + KPI summary cards
5. Phase 5: Trend charts + month-over-month detail table
6. Phase 6: Retention deep-dive tab
7. Phase 7: Premium + Loss Ratio tabs
8. Phase 8: Bonus Planner tab (retired by product decision; legacy Bonus Grid not embedded)
9. Phase 9: AI diagnostic engine + UI analysis panel
10. Phase 10: Upload dialog polish/details
11. Phase 11: Empty/error/loading states
12. Phase 12: Multi-carrier support (deferred, architecture-ready)

Phase deliverables:
- Phase 1:
  - Create/seed `carrier_schemas`, `business_metrics_reports`, `business_metrics_snapshots`, `gic_analyses`.
  - Configure storage bucket `business-metrics`.
  - Apply indexes + RLS from Appendix A.
- Phase 2:
  - Add `src/lib/growth-center/types.ts`.
  - Add hooks: `useBusinessMetricsReports`, `useBusinessMetricsSnapshots`, `useCarrierSchemas`, `useGICAnalysis`.
  - Add page shell: `src/pages/GrowthCenter.tsx`.
  - Add protected route `/growth-center` in `src/App.tsx`.
  - Add sidebar item in Agency Management with `TrendingUp`, label `Growth Center`.
  - Gate visibility with `membership_tier === '1:1 Coaching'`.
- Phase 3:
  - Add `src/components/growth-center/GCUploadDialog.tsx`.
  - Add `supabase/functions/parse_business_metrics/index.ts`.
  - Parse Allstate Business Metrics XLSX via `carrier_schemas.field_map` (no hardcoded cells).
  - Persist raw JSON to `business_metrics_reports.parsed_data`.
  - Flatten key metrics into `business_metrics_snapshots`.
  - Set `parse_status` and `parse_error` correctly.
- Phase 4:
  - Build Overview tab header, agent info bar, KPI cards, and tab shell.
  - Match existing design tokens/components (Card/Badge/Tabs).
- Phase 5:
  - Add chart modes: Growth Points, Retention, Premium, Loss Ratio.
  - Add month-over-month grouped metrics table with polarity-aware delta rendering.
- Phase 6:
  - Add retention deep-dive: LOB bars, tenure comparison, heatmap, biggest gaps.
- Phase 7:
  - Add premium/loss ratio detail tabs and alerting rules (>50% 12MM loss ratio).
- Phase 8:
  - Retired by product decision.
  - Growth Center does not embed legacy Bonus Grid/Snapshot Planner.
  - Legacy `/bonus-grid` and `/snapshot-planner` routes redirect to `/growth-center`.
- Phase 9:
  - Add `supabase/functions/analyze_growth_metrics/index.ts`.
  - Use Anthropic Claude Sonnet 4 model and structured analyst prompt.
  - Support follow-up questions and optional LQS/scorecard context joins.
- Phase 10:
  - Complete upload UX details (month duplicate warning, parse progress, retry).
- Phase 11:
  - Implement empty, incomplete-year warning, loading, and error states.
- Phase 12:
  - Add future carriers by inserting `carrier_schemas` rows only.

Critical implementation rules:
- Keep route protection pattern identical to other protected pages.
- Match sidebar access behavior to existing membership-gated items.
- Use shared edge-function auth/error/cors patterns already established in repo.
- Use dynamic parser mapping from schema JSON; never hardcode row/column coordinates.
- Keep money/percent normalization strict:
  - Dollars: strip symbols/commas, handle negatives in parentheses, store cents.
  - Percentages: strip `%`, normalize to decimal.
  - Empty markers (`--`, `N/A`, blank) -> `null`.
- Preserve existing Bonus Grid logic outside Growth Center; no integration required.

Verification gates (must pass before next phase):
- Phase 1: All schema objects created; `allstate_bm` row present with valid field map.
- Phase 2: `/growth-center` renders and sidebar item appears only for `1:1 Coaching`.
- Phase 3: Upload -> storage write -> parse success -> snapshot row created.
- Phase 4: KPI cards render from snapshot data with correct formatting.
- Phase 5: All chart modes render with month-over-month data.
- Phases 6-7: Deep-dive tabs show LOB metrics and correct sorting/polarity.
- Phase 8: Legacy bonus-grid workflow removed from Growth Center.
- Phase 9: AI analysis returns structured output with numeric grounding.
- Phases 10-11: UX handles replace, parse errors, loading, and zero-data paths gracefully.

Definition of done:
- End-to-end flow works for at least one Allstate monthly report:
  - upload -> parse -> overview/trends/deep dives -> AI analysis.
- Access control, RLS behavior, and route/sidebar gating verified for target membership.
- No regressions to existing Bonus Grid or staff/admin portal behavior.

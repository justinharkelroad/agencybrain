# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Rules

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

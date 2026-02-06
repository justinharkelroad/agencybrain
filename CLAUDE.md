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

### Rule 4: onSuccess callbacks must invalidate cache

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

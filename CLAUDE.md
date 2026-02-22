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
- `onSuccess` callbacks that write metrics data MUST invalidate `['dashboard-daily']` query cache

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

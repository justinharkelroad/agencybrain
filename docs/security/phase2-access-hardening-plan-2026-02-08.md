# Phase 2 Access Hardening Plan (2026-02-08)

## Objective
Close remaining role/access risk across SQL RPCs, RLS policies, and Edge functions after phase-1 call-scoring hardening.

## What Was Already Completed (Phase 1)
- Deny-by-default hardening for key call-scoring RPCs.
- Shared `verify_staff_session(token, agency_id)` helper.
- Cross-agency tamper tests validated deny (`403`) and same-agency allow (`200`).
- `check_and_reset_call_usage` hardened and validated.
- Enum-status runtime issues fixed for call-scoring/coaching paths.

## Phase 2 Scope
1. Current SECURITY DEFINER RPCs that can read/write tenant data.
2. RLS policies still tied to `profiles` lookups instead of `has_agency_access`.
3. Edge functions with mixed/inconsistent auth handling (JWT-only vs staff-session).
4. Function privilege hygiene (PUBLIC execute surface).

## Audit Findings From Repository Scan

### A. RLS policies still using direct `profiles` agency checks in recent migrations
High-signal files to patch:
- `supabase/migrations/20260127200000_voip_integration.sql`
- `supabase/migrations/20260203220000_make_lqs_objections_agency_scoped.sql`
- `supabase/migrations/20260118100004_fix_contact_activities_insert_v2.sql`
- `supabase/migrations/20260131090000_protect_existing_users_and_default_scorecard.sql`

Risk:
- Excludes staff-linked access model and causes inconsistent behavior between owner/key-employee/staff paths.

Required pattern:
- Replace direct `agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())` with `has_agency_access(auth.uid(), agency_id)` where table semantics require agency-scoped access.

### B. Call-scoring/subscription helper functions still legacy-auth shaped
File:
- `supabase/migrations/20260131073720_add_call_scoring_limits_and_packs.sql`

Functions:
- `check_call_scoring_access(p_agency_id)`
- `use_call_score(p_agency_id)`
- `add_purchased_calls(p_agency_id, ...)`
- `reset_subscription_calls(p_agency_id, ...)`

Risk:
- SECURITY DEFINER functions take `p_agency_id` and mutate/access agency balances; if execute privileges are broad or caller checks are absent, this is a tenant-boundary risk surface.

Required pattern:
- Enforce auth branch inside function (`auth.uid()` + `has_agency_access`) OR move to `service_role`-only invocations where appropriate.
- Explicitly REVOKE PUBLIC and GRANT only required roles.

### C. Edge functions with manual auth paths (no `verifyRequest` standard)
A broad set of functions still use ad-hoc checks; notable ones using direct `supabase.auth.getUser(...)` include:
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-delete-user/index.ts`
- `supabase/functions/admin_create_staff_user/index.ts`
- `supabase/functions/admin_link_staff_team_member/index.ts`
- `supabase/functions/admin_reset_staff_password/index.ts`
- `supabase/functions/challenge-verify-session/index.ts`
- `supabase/functions/create-customer-portal-session/index.ts`
- `supabase/functions/generate-roleplay-link/index.ts`
- `supabase/functions/grade-roleplay/index.ts`
- `supabase/functions/purchase-call-pack/index.ts`
- `supabase/functions/roleplay-config/index.ts`
- `supabase/functions/save-report/index.ts`

Risk:
- Inconsistent dual-auth handling and repeated auth logic; easier to miss staff paths or agency checks.

Required pattern:
- Standardize auth gate on `verifyRequest()` for dual-mode endpoints (except truly JWT-only admin endpoints and explicitly pre-auth endpoints).

## Execution Plan (Prioritized)

### Batch 1 (P0, immediate): SQL tenant-boundary hardening
Deliverable: `supabase/migrations/<new_ts>_phase2_harden_tenant_rpcs_and_policies.sql`

Actions:
1. Patch call-balance/call-pack functions to enforce caller agency checks (or lock to service role where app architecture requires).
2. Replace direct profile-based RLS conditions in high-signal files/tables with `has_agency_access`.
3. Add explicit EXECUTE privilege controls on patched functions.

Validation (must pass):
- Cross-agency tamper test => 401/403
- Same-agency call => 200
- Staff and owner happy-path both work

### Batch 2 (P1): Edge auth standardization pass
Deliverable: `supabase/functions/*` patches + optional shared helper updates.

Actions:
1. For tenant-facing endpoints, replace ad-hoc auth checks with `verifyRequest()`.
2. Keep admin-only endpoints JWT-only but enforce explicit admin role checks.
3. Ensure CORS headers include staff headers where endpoint is staff-capable.

Validation:
- Staff session request succeeds where expected.
- Owner JWT request succeeds where expected.
- Missing/invalid auth denied.

### Batch 3 (P1): Canonical privilege audit in production DB
Deliverable: SQL output artifact + migration patch if needed.

Actions:
1. Query all SECURITY DEFINER functions + current EXECUTE grants.
2. Identify any tenant-sensitive function callable by PUBLIC/anon/authenticated inappropriately.
3. Patch grants in one migration.

Validation:
- Verified least-privilege execute surface.

### Batch 4 (P2): Regression suite + runbook
Deliverable: tamper-test scripts + release checklist.

Actions:
1. Add repeatable curl/SQL smoke tests for top-risk RPCs.
2. Add a release gate checklist requiring cross-agency deny + same-agency allow evidence.

## Exact Validation Matrix (for every hardened RPC)
For each RPC in scope:
1. JWT owner + own agency -> expect 200
2. JWT owner + other agency -> expect 401/403
3. Staff token + own agency -> expect 200
4. Staff token + other agency -> expect 401/403
5. No auth/token -> expect 401/403

## Production Safety Controls
- Apply in one migration per batch with adjacent REVOKE/GRANT statements.
- Deploy batch-by-batch; run matrix after each batch before proceeding.
- Do not combine Edge refactors and SQL privilege changes in the same deploy window.

## Recommended Sequence (this week)
1. Batch 1 SQL hardening (today).
2. Batch 1 validation in prod.
3. Batch 2 Edge standardization (tomorrow).
4. Batch 3 privilege audit and patch (tomorrow).
5. Batch 4 scripts/checklist (end of week).

## Definition of Done
- All scoped RPCs and policies pass matrix tests.
- No direct profile-based agency policies remain in active tenant data paths (unless intentionally admin-only and documented).
- All high-risk SECURITY DEFINER functions have explicit least-privilege grants.
- Staff Monday-morning critical flows verified end-to-end.

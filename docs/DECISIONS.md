# Historical Decisions & Incident Reports

Reference document for past architectural decisions, incident reports, and implementation plans. Not a CLAUDE.md — actionable rules live in `/CLAUDE.md` and `/supabase/CLAUDE.md`.

---

## 2026-02-08 Access Hardening Report (Phase 1)

### Executive Summary

A role/access audit confirmed that tenant-bound data RPCs had inconsistent caller verification across JWT users (owners/admins) and staff-session users. This created a real cross-agency exposure path in at least one RPC (`check_and_reset_call_usage`) and a reliability bug in staff-facing coaching endpoints.

All identified high-priority issues were patched and validated in production.

### What Went Wrong

1. **Dual auth models not enforced consistently in SECURITY DEFINER RPCs**
   - JWT auth + RLS for owner/admin/key employee paths
   - `staff_sessions` token model for staff portal paths
   - Some RPCs accepted tenant IDs from input without enforcing caller/agency alignment

2. **Cross-agency access hole in `check_and_reset_call_usage`**
   - Live tamper test using Josh's JWT + another agency UUID returned `HTTP 200` and usage payload
   - Root cause: function allowed agency_id-driven lookup without strict caller-to-agency authorization

3. **Enum mismatch caused runtime failures (`app_member_status`)**
   - App/SQL filters used `'Active'`/empty-string coercion against enum `app_member_status` (`'active'|'inactive'`)
   - Produced `22P02 invalid input value for enum app_member_status` errors

4. **UI ownership boundary regression**
   - Coaching thresholds editor exposed on agency `Call Scoring` page (should be admin-only)

### Production Fixes Applied

#### Database migrations

- `20260208143000_harden_staff_rpc_auth_phase1.sql`
  - Added shared helper `public.verify_staff_session(text, uuid)`
  - Hardened RPCs: `get_staff_call_scoring_data`, `get_staff_call_details`, `is_call_scoring_enabled`, `get_agency_settings`, `get_staff_call_status`, `get_staff_call_metrics`, `get_agency_call_metrics`
  - Applied REVOKE/GRANT execute privileges

- `20260208144500_harden_check_call_usage_auth.sql`
  - Replaced `check_and_reset_call_usage` with strict auth (JWT → `has_agency_access`, staff → `verify_staff_session`, else unauthorized)

- `20260208150000_fix_staff_call_scoring_enum_cast.sql`
  - Fixed enum/text coercion in `verify_staff_session` and `get_staff_call_scoring_data`

#### App/UI changes

- `src/pages/CallScoring.tsx` — Removed coaching-threshold editor from agency Call Scoring; added legacy tab-state cleanup
- `src/pages/admin/CallScoringTemplates.tsx` — Added admin-only Coaching Thresholds tab with agency selector
- `src/hooks/useCoachingInsights.ts` — Fixed enum filter from `'Active'` to `'active'`

### Validation Evidence (Production)

Tamper tests against production (`wjqyccbytctqwceuhzhk`):

| RPC | Cross-agency | Same-agency |
|-----|-------------|-------------|
| `check_and_reset_call_usage` | 403 (PASS) | 200 (PASS) |
| `is_call_scoring_enabled` | 403 (PASS) | 200 (PASS) |
| `get_agency_settings` | 403 (PASS) | 200 (PASS) |
| `get_staff_call_scoring_data` | 403 (PASS) | 200 (PASS) |

UI checks: Agency owner coaching insights (PASS), thresholds hidden from non-admin (PASS), admin thresholds accessible (PASS).

### Residual Risks

1. Remaining SECURITY DEFINER RPCs outside phase-1 may still have inconsistent auth patterns
2. Lovable preview shows noisy auth-bridge/CORS console errors (environment noise, not data-path issues)
3. Manual SQL hotfixes are high risk unless immediately codified in migrations

---

## 2026-02-08 Security Hardening Phase 2 + Edge Auth Standardization

### What Was Changed

#### Database Migrations

- `20260208150000_fix_staff_call_scoring_enum_cast.sql` — Fixed enum-cast/status handling
- `20260208153000_phase2_harden_subscription_call_balance_access.sql` — Hardened subscription/call-balance authorization

#### Edge Function Auth Standardization (commit `a2be58a4`)

Updated functions: `purchase-call-pack`, `save-report`, `roleplay-config`
- Standardized via shared `verifyRequest` utility
- Enforced deny-by-default for invalid/missing auth
- Kept roleplay token compatibility while tightening auth

### Validation Evidence

| RPC | Cross-agency | Same-agency |
|-----|-------------|-------------|
| `check_feature_access` | 403 (PASS) | 200 (PASS) |
| `check_call_scoring_access` | 403 (PASS) | 200 (PASS) |
| Prior hardened endpoints | All 403/200 (PASS) | (PASS) |

UI: Coaching Insights loads (PASS), Call Scoring loads (PASS), save-report works (PASS), admin-only thresholds restricted (PASS).

---

## Monday Morning Access Runbook (2026-02-08)

Use after deploy/publish to validate staff + owner access without breaking tenant isolation.

### Prereqs

1. Fresh owner JWT and/or staff session
2. Two agency IDs: `OWN_AGENCY_ID`, `CROSS_AGENCY_ID`
3. Supabase API URL and anon key in shell env

### Step 1: Confirm DB migrations applied

```bash
supabase migration list
```

### Step 2: Token freshness

If `JWT expired` (`PGRST301`), sign in again and re-copy token.

### Step 3: Core RPC tamper tests

```bash
URL="https://<PROJECT_REF>.supabase.co/rest/v1/rpc"
APIKEY="<SUPABASE_ANON_KEY>"
AUTH="<FRESH_JWT_ACCESS_TOKEN>"
OWN_AGENCY_ID="<CALLER_AGENCY_UUID>"
CROSS_AGENCY_ID="<OTHER_AGENCY_UUID>"

# check_feature_access — cross (expect 401/403)
curl -i "$URL/check_feature_access" -H "apikey: $APIKEY" -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" --data "{\"p_agency_id\":\"$CROSS_AGENCY_ID\",\"p_feature_key\":\"call_scoring\"}"

# check_feature_access — own (expect 200)
curl -i "$URL/check_feature_access" -H "apikey: $APIKEY" -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" --data "{\"p_agency_id\":\"$OWN_AGENCY_ID\",\"p_feature_key\":\"call_scoring\"}"

# Repeat for: check_call_scoring_access, get_contacts_by_stage, get_dashboard_daily,
# is_call_scoring_enabled, get_agency_settings, get_staff_call_scoring_data
```

### Step 4: UI smoke checks (staff)

1. Contacts loads rows
2. Winback HQ — customer panel opens, note saves
3. Renewals — records open, activity saves
4. Cancel Audit — records open, note saves
5. LQS Roadmap — lead source populates, assignment works
6. Scorecard submission succeeds

### Step 5: UI smoke checks (owner/admin)

1. Owner: call scoring pages work
2. Admin: coaching threshold controls accessible
3. Non-admin: coaching thresholds hidden

### Release Blockers

- Own-agency RPC returns unauthorized after token refresh
- Cross-agency RPC returns 200
- Staff cannot load priority pages
- Staff writes fail with FK/auth errors

### Rollback

```bash
git revert <bad_commit_sha> && git push
# If DB migration caused regression:
# Create follow-up migration restoring previous function, then: supabase db push
```

### Evidence Template

Record for each validation: date/time, caller role+agency, RPC tested, cross result, own result, UI result, commit SHA + migration IDs.

---

## Growth Intelligence Center (GIC) Implementation Plan (2026-02-11)

Full plan: `/GROWTH_INTELLIGENCE_CENTER_PLAN_CLAUDE_CODE.md`

### Scope

Build Growth Center for `1:1 Coaching` agencies. Upload + parse pipeline, analytics tabs, AI diagnostics.

### Phase Order

1. Database + Storage setup
2. Types + hooks + route shell + sidebar item
3. Upload dialog + parse edge function
4. Overview tab + KPI summary cards
5. Trend charts + month-over-month detail table
6. Retention deep-dive tab
7. Premium + Loss Ratio tabs
8. Bonus Planner (retired by product decision)
9. AI diagnostic engine + UI analysis panel
10. Upload dialog polish
11. Empty/error/loading states
12. Multi-carrier support (deferred)

### Critical Rules

- Dynamic parser mapping from `carrier_schemas.field_map` JSON — never hardcode cell coordinates
- Money normalization: strip symbols/commas, handle parens for negatives, store cents
- Percentage normalization: strip `%`, normalize to decimal
- Empty markers (`--`, `N/A`, blank) → `null`
- Gate with `membership_tier === '1:1 Coaching'`
- Legacy `/bonus-grid` and `/snapshot-planner` routes redirect to `/growth-center`

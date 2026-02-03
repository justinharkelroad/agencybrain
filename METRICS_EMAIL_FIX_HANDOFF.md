# Metrics Email Fix - Handoff for New Context

**Date:** 2026-02-03
**Status:** Bug found and fixed - needs redeployment

---

## Bug Found (2026-02-03)

**Root Cause:** The email functions only added "Quoted Households" to the email if `metricsDaily?.quoted_count > 0`. This meant:
- If the KPI was enabled for the agency (in Settings → Configure Sales KPIs)
- But the form didn't have the KPI field
- AND no quotes were added via dashboard (value = 0)
- → The KPI would NOT appear in the email

**Fix Applied:**
1. Now queries `scorecard_rules` table to get the agency's enabled KPIs
2. Checks if `quoted_households` or `items_sold` are in `selected_metrics`
3. Adds these to the email if enabled, **even if value is 0**

**Files Updated:**
- `supabase/functions/send_submission_feedback/index.ts`
- `supabase/functions/send_daily_summary/index.ts`

---

## What Was Implemented

### 1. Database Migration (DEPLOYED)
**File:** `supabase/migrations/20260203105035_fix_metrics_max_quoted_sold.sql`

- Updated `upsert_metrics_from_submission` to use `GREATEST()` for `quoted_count` and `sold_items`
- This prevents form submission from overwriting higher dashboard-added counts
- Added index `idx_lqs_households_tracked_count` on `lqs_households`

### 2. Edge Functions (DEPLOYED)

**`supabase/functions/send_submission_feedback/index.ts`:**
- Queries `metrics_daily` for source of truth (includes dashboard quotes)
- Queries `quoted_household_details` AND `lqs_households` for tracked counts
- Uses MAX of both tracking sources
- Adds discrepancy detection when reported > tracked
- Includes metrics not in form but present in metrics_daily

**`supabase/functions/send_daily_summary/index.ts`:**
- Batch queries `lqs_households` for tracked counts per team member
- Batch queries `metrics_daily` for all team members
- Uses `metrics_daily` values for `quoted_count` and `sold_items`
- Adds discrepancy detection with asterisk markers
- **ALSO** includes metrics not in form but in metrics_daily (added same logic as submission feedback)

**`supabase/functions/_shared/email-template.ts`:**
- Updated `statsTable` to support `hasDiscrepancy` and `discrepancyNote`
- Renders asterisk (*) indicator and warning footnote box

### 3. Additional Fix (DEPLOYED)
**File:** `supabase/migrations/20260203123014_fix_has_agency_access_for_staff_users.sql`

- Fixed `has_agency_access` to check `staff_users.linked_profile_id`
- This was a pre-existing bug where staff users couldn't insert into `agency_contacts`
- **THIS FIX WORKED** - sidebar now opens for staff users

---

## The Problem That Needs Debugging

The user tested as a staff person:
1. Added quotes via Dashboard quote button ✅
2. Quotes appeared in LQS ✅
3. Sidebar now opens when clicking names ✅ (fixed above)
4. **BUT: The email metrics are not working as expected**

The exact symptom is unclear - the user said "its not working" but didn't specify:
- Is the email not being sent?
- Is the email missing the dashboard quotes?
- Is the discrepancy detection not showing?
- Something else?

---

## Key Design Decisions (from original plan)

1. **ALL roles subject to discrepancy detection** - including Manager, no exemptions
2. **Use `quoted_household_details` for immediate email** - sync lag safety
3. **Use `lqs_households` for daily summary** - end of day, complete
4. **Status filter `IN ('quoted', 'sold')`** - don't count leads
5. **Asterisk + footnote** for email client compatibility

---

## Testing Scenarios (from original plan)

### Test 1: Dashboard-Only Quotes Appear in Email
1. Add 3 households via dashboard button (no form submission yet)
2. Submit scorecard with `quoted_households = 0` (or field not on form)
3. **Expected:** Email shows "Quoted Households: 3"

### Test 2: MAX Logic Preserves Higher Count
1. Add 4 households via dashboard
2. Submit form with `quoted_households = 2`
3. **Expected:** `metrics_daily.quoted_count = 4` (not 2)
4. **Expected:** Email shows "4"

### Test 3: Form Can Increase Count
1. Add 2 households via dashboard
2. Submit form with `quoted_households = 5`
3. **Expected:** `metrics_daily.quoted_count = 5`
4. **Expected:** Email shows "5*" with footnote "3 households not tracked with details"

### Test 4: No Discrepancy When Counts Match
1. Add 3 households via dashboard with full details
2. Submit form with `quoted_households = 3`
3. **Expected:** Email shows "3" with no asterisk or footnote

---

## Files Modified

| File | Status |
|------|--------|
| `supabase/migrations/20260203105035_fix_metrics_max_quoted_sold.sql` | DEPLOYED |
| `supabase/migrations/20260203123014_fix_has_agency_access_for_staff_users.sql` | DEPLOYED |
| `supabase/functions/send_submission_feedback/index.ts` | DEPLOYED |
| `supabase/functions/send_daily_summary/index.ts` | DEPLOYED |
| `supabase/functions/_shared/email-template.ts` | DEPLOYED |

---

## Original Plan Document

See `METRICS_EMAIL_FIX_PLAN.md` at project root for full implementation details.

---

## Next Steps for Debugging

1. **Ask user for specific symptoms** - what exactly isn't working?
2. **Check Supabase Edge Function logs** - look for errors in `send_submission_feedback`
3. **Check `metrics_daily` table** - verify GREATEST() is working
4. **Check email content** - is it being sent? What does it show?
5. **Verify the form template** - does it have `quoted_households` KPI or not?

---

## Key Code Locations

- Email trigger: `send_submission_feedback` is called after form submission
- Metrics upsert: `upsert_metrics_from_submission` trigger on submissions table
- Dashboard quote add: likely uses `lqs_households` or `quoted_household_details` tables
- Form KPI schema: `form_templates.schema_json.kpis`

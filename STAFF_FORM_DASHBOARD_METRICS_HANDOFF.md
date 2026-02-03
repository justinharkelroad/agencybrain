# Staff Form Dashboard Metrics - Handoff

**Date:** 2026-02-03
**Status:** FIXED - Both email and form UI now working

---

## What's Working

### Email Fix (COMPLETE)
When a staff person submits a scorecard form that does NOT have "Quoted Households" as a field, but the agency has:
1. Quoted Households as an enabled KPI (in Configure Sales KPIs)
2. Dashboard-added quotes via the LQS system

The **email** now correctly shows "Quoted Households: 3 / 5" (or whatever the actual values are).

**Files that were fixed:**
- `supabase/functions/send_submission_feedback/index.ts` - queries `scorecard_rules` for enabled KPIs, uses `lqs_households` count
- `supabase/functions/send_daily_summary/index.ts` - same logic for daily summary emails

---

## What's NOT Working

### Form UI Performance Summary
The staff form submission page (`src/pages/StaffFormSubmission.tsx`) shows:
- **"Performance Summary: 0/3 targets met (0%)"**

But it SHOULD show:
- **"Performance Summary: 0/4 targets met (0%)"** - including the dashboard Quoted Households

The user has 3 quotes added via dashboard for today (02/03/2026). The form doesn't have "Quoted Households" as a field, but the agency has it configured as a KPI with target 5.

---

## What Was Attempted

### 1. Direct Supabase Query (FAILED)
First attempt was to query `lqs_households` and `metrics_daily` directly in the useEffect:
```javascript
const { count: quotedCount } = await supabase
  .from('lqs_households')
  .select('*', { count: 'exact', head: true })
  .eq('team_member_id', user.team_member_id)
  ...
```

**Problem:** Staff users don't use Supabase Auth - they have custom session tokens. Direct queries likely return nothing due to RLS.

### 2. Edge Function (DEPLOYED but not working)
Created `supabase/functions/staff_get_dashboard_metrics/index.ts` that:
1. Validates staff session token
2. Queries with service role key
3. Returns `dashboardQuotedCount` and `dashboardSoldCount`

Updated `src/pages/StaffFormSubmission.tsx` to call this function:
```javascript
const { data, error } = await supabase.functions.invoke('staff_get_dashboard_metrics', {
  body: { workDate: values.work_date },
  headers: { 'x-staff-session': sessionToken }
});
```

**Current State:**
- Edge function deployed
- Config.toml updated
- Frontend code updated
- But form still shows 0/3, no console errors

---

## Debugging Needed

1. **Check if edge function is being called** - Add console.log in the useEffect
2. **Check if edge function returns data** - Log the response
3. **Check if `dashboardQuotedCount` state is being set** - Log state changes
4. **Check the `performanceSummary` useMemo** - The condition might not be triggering

### Key Code Locations

**Frontend - StaffFormSubmission.tsx:**
- Lines ~62-64: State for `dashboardQuotedCount` and `dashboardSoldCount`
- Lines ~159-183: useEffect that calls edge function
- Lines ~285-350: `performanceSummary` useMemo that should include dashboard metrics

**Condition to add dashboard metrics (line ~318):**
```javascript
const quotedTarget = targets['quoted_households'] ?? targets['quoted_count'] ?? 0;
if (quotedTarget > 0 && !formKpiKeys.has('quoted_households') && dashboardQuotedCount > 0) {
```

This requires:
1. `quotedTarget > 0` - agency has a target set for quoted_households
2. `!formKpiKeys.has('quoted_households')` - form doesn't have this field
3. `dashboardQuotedCount > 0` - there are dashboard quotes

**Possible Issues:**
- The targets might be stored under a different key (e.g., `quoted_count` instead of `quoted_households`)
- The edge function might be returning but the state isn't updating before performanceSummary runs
- The normalizeKey function might not be matching correctly

---

## Test Scenario

1. Staff user logs in
2. Agency has 4 KPIs configured: Items Sold, Outbound Calls, Quoted Households, Talk Time Minutes
3. Form only has 3 fields: Items Sold, Outbound Calls, Talk Time
4. Staff user added 3 quotes via dashboard for today
5. Expected: Form shows "0/4 targets met" on load
6. Actual: Form shows "0/3 targets met"

---

## Files Modified

| File | Status |
|------|--------|
| `supabase/functions/send_submission_feedback/index.ts` | WORKING |
| `supabase/functions/send_daily_summary/index.ts` | WORKING |
| `supabase/functions/staff_get_dashboard_metrics/index.ts` | NEW - needs debugging |
| `src/pages/StaffFormSubmission.tsx` | MODIFIED - needs debugging |
| `supabase/config.toml` | UPDATED with new function |

---

## Fix Applied (2026-02-03)

### Root Cause
The form UI was missing logic that the email function had:
1. **No `scorecard_rules` fetch** - The form didn't check which KPIs are enabled for the agency
2. **Incomplete key checking** - Only checked `quoted_households` and `quoted_count`, not all variations (`policies_quoted`, `households_quoted`)
3. **Wrong condition** - Required `dashboardQuotedCount > 0` to show the metric, but should show if KPI is enabled OR has a target

### Changes Made to `src/pages/StaffFormSubmission.tsx`

1. **Added `enabledKpis` state** (line ~66):
   ```javascript
   const [enabledKpis, setEnabledKpis] = useState<Set<string>>(new Set());
   ```

2. **Fetch `scorecard_rules`** in the `loadForm` useEffect (lines ~147-158):
   ```javascript
   const formRole = template.schema_json?.role || 'Sales';
   const { data: scorecardRules } = await supabase
     .from('scorecard_rules')
     .select('selected_metrics')
     .eq('agency_id', template.agency_id)
     .eq('role', formRole)
     .single();

   if (scorecardRules?.selected_metrics) {
     setEnabledKpis(new Set(scorecardRules.selected_metrics));
   }
   ```

3. **Updated `performanceSummary` useMemo** to match email function logic:
   - Check all key variations (`quoted_households`, `quoted_count`, `policies_quoted`, `households_quoted`)
   - Show metric if: enabled in scorecard_rules OR has target configured OR has dashboard data
   - Added `enabledKpis` to dependency array

### How It Works Now
The form UI now uses the same logic as `send_submission_feedback`:
- Checks `scorecard_rules.selected_metrics` for enabled KPIs
- Falls back to `targets` table if scorecard_rules doesn't have the key
- Shows the dashboard metric even if current count is 0 (as long as target > 0)

## Previous Notes

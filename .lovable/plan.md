
# Fix Meeting Frame KPI Display for Role-Based Filtering

## Problem Summary

When generating a Meeting Frame report for **Cristal Reyes (Service role)**:
- **Date range 1/1/26 - 1/26/26**: Shows 6 KPI circles (Cross-sells, Mini Reviews, Outbound Calls, Talk Minutes, Talk Time, Total Calls)
- **Date range 1/19/26 - 1/26/26**: Shows ~20 KPI circles, all with zeros

The issue is caused by two factors:
1. Meeting Frame displays **all agency KPIs** instead of filtering by the team member's **role-specific metrics**
2. The "show non-zero only" logic (`nonZeroTotals`) causes inconsistent display

| Date Range | Has Data? | Behavior |
|------------|-----------|----------|
| 1/1 - 1/26 | Yes (5 days) | Shows only 6 non-zero KPIs |
| 1/19 - 1/26 | No (1 day with zeros) | Shows ALL 20 agency KPIs |

---

## Root Cause Analysis

The Meeting Frame currently fetches **all active KPIs** for the agency:

```typescript
// Current code - fetches ALL agency KPIs regardless of role
const { data, error } = await supabase
  .from('kpis')
  .select('id, key, label, type')
  .eq('agency_id', agencyId)
  .eq('is_active', true)
  .order('label');
```

This ignores the role-specific `selected_metrics` in `scorecard_rules`:
- **Sales**: items_sold, custom_1769552938936, outbound_calls, quoted_households, talk_minutes
- **Service**: cross_sells_uncovered, mini_reviews, custom_1769554851688, talk_minutes, outbound_calls

---

## Solution

### Step 1: Fetch Team Member's Role When Selected

When a team member is selected, determine their role and fetch the corresponding `selected_metrics` from `scorecard_rules`.

### Step 2: Filter KPIs by Role-Specific Metrics

Instead of showing all agency KPIs, filter to only show KPIs whose `key` is in the team member's role-specific `selected_metrics` array.

### Step 3: Remove Confusing "Non-Zero Only" Logic

The current behavior of hiding zeros is confusing because:
- It shows different KPI counts for different date ranges
- Users expect consistent metrics regardless of data presence

The fix will show all role-relevant KPIs consistently, with zeros displayed when no data exists.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/agency/MeetingFrameTab.tsx` | Filter KPIs by role-specific selected_metrics |
| `supabase/functions/scorecards_admin/index.ts` | Update `meeting_frame_generate` to include role filtering |

---

## Technical Implementation

### Frontend Changes (MeetingFrameTab.tsx)

```typescript
// 1. Add state for role-specific metrics
const [roleMetrics, setRoleMetrics] = useState<string[]>([]);

// 2. When member is selected, fetch their role's selected_metrics
useEffect(() => {
  async function fetchRoleMetrics() {
    if (!selectedMember) return;
    
    const member = teamMembers.find(m => m.id === selectedMember);
    if (!member) return;
    
    // Handle Hybrid/Manager: show all metrics from Sales + Service
    const rolesToCheck = member.role === 'Hybrid' || member.role === 'Manager' 
      ? ['Sales', 'Service'] 
      : [member.role];
    
    const { data: rules } = await supabase
      .from('scorecard_rules')
      .select('selected_metrics')
      .eq('agency_id', agencyId)
      .in('role', rolesToCheck);
    
    // Combine all selected_metrics from matching roles
    const metrics = new Set<string>();
    rules?.forEach(rule => {
      (rule.selected_metrics || []).forEach(m => metrics.add(m));
    });
    
    setRoleMetrics(Array.from(metrics));
  }
  fetchRoleMetrics();
}, [selectedMember, teamMembers, agencyId]);

// 3. Filter KPIs by role metrics when aggregating
const filteredKpis = roleMetrics.length > 0
  ? kpis.filter(kpi => roleMetrics.includes(kpi.key))
  : kpis;

// 4. Use filteredKpis in aggregation
const totals: KPITotal[] = filteredKpis.map((kpi) => { ... });

// 5. Always show all role-relevant KPIs (remove non-zero filtering)
setKpiTotals(totals); // Remove the nonZeroTotals logic
```

### Edge Function Changes (scorecards_admin/index.ts)

Update `meeting_frame_generate` to return role-filtered metrics:

```typescript
case 'meeting_frame_generate': {
  const { team_member_id, start_date, end_date } = params;
  
  // Get team member's role
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('id', team_member_id)
    .single();
  
  // Get role-specific selected_metrics
  const rolesToCheck = member?.role === 'Hybrid' || member?.role === 'Manager'
    ? ['Sales', 'Service']
    : [member?.role];
    
  const { data: rules } = await supabase
    .from('scorecard_rules')
    .select('selected_metrics')
    .eq('agency_id', agencyId)
    .in('role', rolesToCheck);
  
  // Fetch metrics as before...
  
  result = { 
    metricsData, 
    roleMetrics: combinedSelectedMetrics 
  };
  break;
}
```

---

## Expected Outcome

**Before (confusing)**:
- Service member + data → Shows 6 circles
- Service member + no data → Shows 20 circles

**After (consistent)**:
- Service member always shows 5 Service KPI circles (cross_sells_uncovered, mini_reviews, custom_1769554851688, talk_minutes, outbound_calls)
- Sales member always shows 5 Sales KPI circles
- Zeros displayed when no data (clear visual feedback)

---

## Visualization

```text
Current Flow (Broken):
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ Select Member   │───▶│ Show ALL KPIs    │───▶│ Filter to non-zero   │
│ (any role)      │    │ (~20 circles)    │    │ (inconsistent count) │
└─────────────────┘    └──────────────────┘    └──────────────────────┘

Fixed Flow:
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ Select Member   │───▶│ Get role metrics │───▶│ Show only role KPIs  │
│ (Service role)  │    │ from scorecard   │    │ (always 5 circles)   │
└─────────────────┘    └──────────────────┘    └──────────────────────┘
```

---

## Duplicate KPI Cleanup (Recommended)

The agency has duplicate KPIs with the same key:
- `talk_minutes`: "Talk Minutes" and "Talk Time"
- `outbound_calls`: "Outbound Calls" and "Total Calls" (x3!)

This should be cleaned up to prevent double-counting, but the role filtering will mask this issue since only metrics in `selected_metrics` will display.

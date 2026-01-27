

# Fix Custom KPI Display Issues for Mayra Menchaca Agency

## Problem Summary

The custom KPIs and standard metrics are displaying incorrectly in the Meeting Frame because:

1. **No Role Filtering**: The system fetches ALL 20 agency KPIs instead of just the 5 metrics defined for Sales or Service
2. **Inconsistent Display**: The "show non-zero only" logic shows different KPI counts based on data presence
3. **Duplicate KPI Keys**: Same keys (`outbound_calls`, `talk_minutes`) exist with different labels per role, causing confusion

### Current Agency KPI Configuration

**Sales Role** (5 selected metrics):
- `items_sold` - Items Sold
- `custom_1769552938936` - NEW CONVOS 10MN+ (custom)
- `outbound_calls` - Outbound Calls
- `quoted_households` - Quoted Households  
- `talk_minutes` - Talk Minutes

**Service Role** (5 selected metrics):
- `cross_sells_uncovered` - Cross-sells Uncovered
- `mini_reviews` - Mini Reviews Completed
- `custom_1769554851688` - Renewals (custom)
- `talk_minutes` - Talk Time
- `outbound_calls` - Total Calls

---

## Solution Overview

### Step 1: Add Role-Based KPI Filtering to Meeting Frame

When a team member is selected, fetch their role and filter KPIs to only those in their `selected_metrics` from `scorecard_rules`.

**File: `src/components/agency/MeetingFrameTab.tsx`**

Changes:
1. Add state for role-specific metrics
2. When member selected, lookup their role from teamMembers list
3. Fetch `selected_metrics` from `scorecard_rules` for that role
4. Filter the KPIs to only those whose `key` is in `selected_metrics`
5. Use filtered KPIs for aggregation (remove the confusing non-zero filter)

```text
Flow Change:
BEFORE: Fetch ALL KPIs → Aggregate ALL → Show non-zero
AFTER:  Fetch ALL KPIs → Filter by role → Aggregate filtered → Show ALL role KPIs
```

### Step 2: Update Edge Function for Staff Mode

**File: `supabase/functions/scorecards_admin/index.ts`**

Update `meeting_frame_list` action to include team member roles in response.

Update `meeting_frame_generate` action to:
1. Accept optional `role` parameter
2. Return `roleMetrics` array from `scorecard_rules.selected_metrics`
3. Filter KPIs server-side for consistency

### Step 3: Handle Hybrid/Manager Roles

For Hybrid and Manager roles, combine metrics from both Sales and Service:

```typescript
const rolesToCheck = (role === 'Hybrid' || role === 'Manager') 
  ? ['Sales', 'Service'] 
  : [role];
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/agency/MeetingFrameTab.tsx` | Add role-based filtering when member selected |
| `supabase/functions/scorecards_admin/index.ts` | Update `meeting_frame_generate` to return role-filtered metrics |

---

## Technical Implementation Details

### Frontend Changes (MeetingFrameTab.tsx)

```typescript
// 1. Add state for role-specific metrics
const [roleMetrics, setRoleMetrics] = useState<string[]>([]);

// 2. Effect to fetch role metrics when member changes
useEffect(() => {
  async function fetchRoleMetrics() {
    if (!selectedMember) {
      setRoleMetrics([]);
      return;
    }
    
    const member = teamMembers.find(m => m.id === selectedMember);
    if (!member) return;
    
    // Hybrid/Manager: merge Sales + Service metrics
    const rolesToCheck = (member.role === 'Hybrid' || member.role === 'Manager')
      ? ['Sales', 'Service']
      : [member.role];
    
    const { data: rules } = await supabase
      .from('scorecard_rules')
      .select('selected_metrics')
      .eq('agency_id', agencyId)
      .in('role', rolesToCheck);
    
    const metrics = new Set<string>();
    rules?.forEach(rule => {
      (rule.selected_metrics || []).forEach((m: string) => metrics.add(m));
    });
    
    setRoleMetrics(Array.from(metrics));
  }
  
  fetchRoleMetrics();
}, [selectedMember, teamMembers, agencyId]);

// 3. In generateReport(), filter KPIs before aggregation
const filteredKpis = roleMetrics.length > 0
  ? kpis.filter(kpi => roleMetrics.includes(kpi.key))
  : kpis;

const totals: KPITotal[] = filteredKpis.map((kpi) => {
  // ... aggregation logic
});

// 4. Remove non-zero filtering - show all role-relevant KPIs
setKpiTotals(totals);
```

### Edge Function Changes (scorecards_admin/index.ts)

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
  const rolesToCheck = (member?.role === 'Hybrid' || member?.role === 'Manager')
    ? ['Sales', 'Service']
    : [member?.role];
    
  const { data: rules } = await supabase
    .from('scorecard_rules')
    .select('selected_metrics')
    .eq('agency_id', agencyId)
    .in('role', rolesToCheck);
  
  const roleMetrics = new Set<string>();
  rules?.forEach(r => (r.selected_metrics || []).forEach(m => roleMetrics.add(m)));
  
  // Fetch metrics data
  const { data: metricsData } = await supabase
    .from('metrics_daily')
    .select('*')
    .eq('team_member_id', team_member_id)
    .gte('date', start_date)
    .lte('date', end_date);
  
  result = { 
    metricsData, 
    roleMetrics: Array.from(roleMetrics),
    memberRole: member?.role
  };
  break;
}
```

---

## Expected Results

**Before (confusing):**
- Select Cristal Reyes (Service) → Date range with data shows 6 circles
- Select Cristal Reyes (Service) → Date range without data shows 20+ circles

**After (consistent):**
- Select Cristal Reyes (Service) → Always shows exactly 5 Service circles:
  - Cross-sells Uncovered
  - Mini Reviews Completed
  - Renewals (custom_1769554851688)
  - Talk Time (talk_minutes)
  - Total Calls (outbound_calls)
- Zeros displayed when no data exists (clear visual feedback)

---

## Data Cleanup Note (Recommended but Optional)

The agency has some duplicate custom KPIs that could be cleaned up:
- `custom_1767895378128` = "Total Call"
- `custom_1768416774137` = "Total Calls"
- `outbound_calls` = "Total Calls" (Service version)

These all represent the same metric. Only one should be in `selected_metrics`, which is already the case (`outbound_calls`). No immediate action needed, but the owner may want to deactivate the unused custom KPIs later.



# Fix Meeting Frame KPI Display: Role-Based Filtering

## Problem

The Meeting Frame shows inconsistent KPI circles because:
1. It fetches ALL 20+ agency KPIs instead of only the 5 relevant to the selected team member's role
2. The "show only non-zero" logic causes different circle counts depending on data presence

**Current behavior:**
- Service member with data → 6 circles
- Service member without data → 20+ circles (all zeros)

## Solution

Add role-based KPI filtering so the Meeting Frame only displays KPIs configured for the selected team member's role (Sales, Service, Hybrid, or Manager).

---

## Changes Overview

| File | Change |
|------|--------|
| `src/components/agency/MeetingFrameTab.tsx` | Filter KPIs by role's `selected_metrics`, remove non-zero filter |
| `supabase/functions/scorecards_admin/index.ts` | Return role-specific metrics from `meeting_frame_generate` |

---

## Step 1: Update Edge Function

**File:** `supabase/functions/scorecards_admin/index.ts`

### 1A: Update `meeting_frame_list` (lines 700-726)

Include scorecard rules in the response so the frontend knows which metrics belong to each role:

```typescript
case 'meeting_frame_list': {
  // Get team members
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name, role')
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .order('name');

  // Get ALL KPIs (frontend will filter by role)
  const { data: kpis } = await supabase
    .from('kpis')
    .select('id, key, label, type')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('label');

  // Get scorecard rules for all roles (new!)
  const { data: scorecardRules } = await supabase
    .from('scorecard_rules')
    .select('role, selected_metrics')
    .eq('agency_id', agencyId);

  // Get meeting frame history
  const { data: history } = await supabase
    .from('meeting_frames')
    .select(`*, team_members (name, role)`)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(50);

  result = { teamMembers, kpis, history, scorecardRules };
  break;
}
```

### 1B: Update `meeting_frame_generate` (lines 729-748)

Return the team member's role and their role-specific metrics:

```typescript
case 'meeting_frame_generate': {
  const { team_member_id, start_date, end_date } = params;

  if (!team_member_id || !start_date || !end_date) {
    return new Response(
      JSON.stringify({ error: 'team_member_id, start_date, and end_date are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get team member's role
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('id', team_member_id)
    .single();

  const memberRole = member?.role || 'Sales';

  // Get role-specific selected_metrics (Hybrid/Manager get both)
  const rolesToCheck = (memberRole === 'Hybrid' || memberRole === 'Manager')
    ? ['Sales', 'Service']
    : [memberRole];

  const { data: rules } = await supabase
    .from('scorecard_rules')
    .select('selected_metrics')
    .eq('agency_id', agencyId)
    .in('role', rolesToCheck);

  // Combine selected_metrics from all matching roles
  const roleMetrics: string[] = [];
  (rules || []).forEach((r: any) => {
    (r.selected_metrics || []).forEach((m: string) => {
      if (!roleMetrics.includes(m)) roleMetrics.push(m);
    });
  });

  // Fetch metrics data
  const { data: metricsData, error: metricsError } = await supabase
    .from('metrics_daily')
    .select('*')
    .eq('team_member_id', team_member_id)
    .gte('date', start_date)
    .lte('date', end_date);

  if (metricsError) throw metricsError;
  result = { metricsData, roleMetrics, memberRole };
  break;
}
```

---

## Step 2: Update Frontend Component

**File:** `src/components/agency/MeetingFrameTab.tsx`

### 2A: Add State for Scorecard Rules (around line 104)

```typescript
const [scorecardRules, setScorecardRules] = useState<Record<string, string[]>>({});
```

### 2B: Update Initial Data Fetch (lines 108-155)

Store scorecard rules when loading initial data:

**Staff mode (line 116):**
```typescript
// Build role -> selected_metrics map
const rulesMap: Record<string, string[]> = {};
(result.scorecardRules || []).forEach((r: any) => {
  rulesMap[r.role] = r.selected_metrics || [];
});
setScorecardRules(rulesMap);
```

**Owner mode (add after line 145):**
```typescript
const fetchScorecardRules = async () => {
  const { data } = await supabase
    .from('scorecard_rules')
    .select('role, selected_metrics')
    .eq('agency_id', agencyId);
  
  const rulesMap: Record<string, string[]> = {};
  (data || []).forEach((r: any) => {
    rulesMap[r.role] = r.selected_metrics || [];
  });
  setScorecardRules(rulesMap);
};

fetchScorecardRules();
```

### 2C: Update generateReport() (lines 244-263)

Filter KPIs by role before aggregation:

```typescript
// Get selected member's role
const member = teamMembers.find(m => m.id === selectedMember);
const memberRole = member?.role || 'Sales';

// Get role-specific metrics (Hybrid/Manager get both Sales + Service)
let roleMetrics: string[] = [];
if (memberRole === 'Hybrid' || memberRole === 'Manager') {
  roleMetrics = [
    ...(scorecardRules['Sales'] || []),
    ...(scorecardRules['Service'] || [])
  ];
} else {
  roleMetrics = scorecardRules[memberRole] || [];
}

// Deduplicate
roleMetrics = [...new Set(roleMetrics)];

// Filter KPIs to only those in the role's selected_metrics
const filteredKpis = roleMetrics.length > 0
  ? kpis.filter(kpi => roleMetrics.includes(kpi.key))
  : kpis;

// Aggregate KPI totals using filtered list
const totals: KPITotal[] = filteredKpis.map((kpi) => {
  let total = 0;
  metricsData.forEach((row) => {
    total += getMetricValue(row, kpi.key);
  });

  return {
    kpi_id: kpi.id,
    key: kpi.key,
    label: kpi.label,
    total,
    type: kpi.type,
  };
});

// Show ALL role-relevant KPIs (remove non-zero filter)
setKpiTotals(totals);
```

---

## Expected Outcome

**After fix:**
- **Service member** → Always shows exactly 5 circles:
  - Cross-sells Uncovered
  - Mini Reviews Completed
  - Renewals
  - Talk Time
  - Total Calls

- **Sales member** → Always shows exactly 5 circles:
  - Items Sold
  - NEW CONVOS 10MN+
  - Outbound Calls
  - Quoted Households
  - Talk Minutes

- **Hybrid/Manager** → Shows combined metrics from both roles (up to 10 circles)

- Zeros display when no data exists (consistent, predictable UI)

---

## Technical Flow Diagram

```text
Before (Broken):
┌─────────────┐    ┌───────────────┐    ┌─────────────────────┐
│ Select      │───▶│ Fetch ALL 20  │───▶│ Filter non-zero     │
│ Member      │    │ agency KPIs   │    │ (inconsistent count)│
└─────────────┘    └───────────────┘    └─────────────────────┘

After (Fixed):
┌─────────────┐    ┌───────────────┐    ┌─────────────────────┐
│ Select      │───▶│ Get role from │───▶│ Filter KPIs by      │
│ Member      │    │ teamMembers   │    │ selected_metrics    │
└─────────────┘    └───────────────┘    └─────────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────────┐
                                        │ Show all role KPIs  │
                                        │ (always 5 circles)  │
                                        └─────────────────────┘
```

---

## Prevention

This fix ensures consistent behavior by:
1. **Role-based filtering**: Only metrics configured for the role appear
2. **No non-zero filter**: All role metrics display regardless of data
3. **Centralized rules**: Uses `scorecard_rules.selected_metrics` as the source of truth

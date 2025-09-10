# Gate G — Dashboard Fixes Implementation

## Overview
Fixed dashboard duplicates, implemented day-of filtering, and aligned KPI mapping between dashboard and targets.

## SCOPE A — RPC Function Changes

### Function SQL Diff
```sql
-- OLD: get_versioned_dashboard_data(p_agency_slug text, p_role text, p_consolidate_versions boolean)
-- NEW: get_versioned_dashboard_data(p_agency_slug text, p_role text, p_start date, p_end date)

CREATE OR REPLACE FUNCTION public.get_versioned_dashboard_data(
  p_agency_slug text,
  p_role text,
  p_start date,
  p_end date
)
RETURNS TABLE(
  date date,
  team_member_id uuid,
  team_member_name text,
  kpi_key text,
  kpi_label text,
  kpi_version_id uuid,
  value numeric,
  pass boolean,
  hits int,
  daily_score int,
  is_late boolean
) AS $$
WITH agency AS (
  SELECT id FROM agencies WHERE slug = p_agency_slug
),
base AS (
  SELECT
    md.date,
    md.team_member_id,
    tm.name AS team_member_name,
    k.key AS kpi_key,
    COALESCE(md.label_at_submit, kv.label) AS kpi_label,  -- ✅ label_at_submit first
    md.kpi_version_id,
    (COALESCE(md.outbound_calls,0)
     + COALESCE(md.talk_minutes,0)
     + COALESCE(md.quoted_count,0)
     + COALESCE(md.sold_items,0))::numeric AS value,
    COALESCE(md.pass,false) AS pass,
    COALESCE(md.hits,0) AS hits,
    COALESCE(md.daily_score,0) AS daily_score,
    COALESCE(md.is_late,false) AS is_late
  FROM metrics_daily md
  JOIN agency a ON md.agency_id = a.id
  JOIN team_members tm ON tm.id = md.team_member_id
  LEFT JOIN kpi_versions kv ON kv.id = md.kpi_version_id
  LEFT JOIN kpis k ON k.id = kv.kpi_id
  -- ✅ require a matching final submission for that tm/date (NO PHANTOM ROWS)
  JOIN submissions s
    ON s.team_member_id = md.team_member_id
   AND COALESCE(s.work_date, s.submission_date) = md.date
   AND s.final IS TRUE
  WHERE md.role::text = p_role
    AND md.date BETWEEN p_start AND p_end  -- ✅ date-bounded params
)
SELECT * FROM base
ORDER BY date DESC, team_member_name ASC;
$$ LANGUAGE sql STABLE SECURITY INVOKER;
```

### Key Changes:
1. **Date Range Parameters**: Replaced consolidation logic with explicit start/end dates
2. **Submission Requirement**: Added JOIN to submissions table requiring final=TRUE
3. **Label Priority**: Uses `label_at_submit` first, then current `kpi_versions.label`
4. **No Phantom Rows**: Only shows data where actual submissions exist

## SCOPE B — Frontend Changes

### Hook Signature Update
```typescript
// OLD
export function useVersionedDashboardData(
  agencySlug: string,
  role: \"Sales\" | \"Service\",
  options: DashboardOptions = {}
)

// NEW  
export function useVersionedDashboardData(
  agencySlug: string,
  role: \"Sales\" | \"Service\", 
  startDate: Date,
  endDate: Date,
  options: DashboardOptions = {}
)
```

### Dashboard Component Changes
```typescript
// Pass explicit date range (today view = same start/end date)
const { data: dashboardData } = useDashboardDataWithFallback(
  agencyProfile?.agencySlug || \"\",
  role,
  selectedDate, // start date
  selectedDate, // end date (same day for \"today\" view)
  { consolidateVersions: false }
);

// Empty state handling
{rows.length === 0 ? (
  <tr>
    <td colSpan={10} className=\"p-8 text-center text-muted-foreground\">
      <div className=\"flex flex-col items-center gap-3\">
        <div className=\"text-4xl opacity-50\">📝</div>
        <div className=\"text-lg font-medium\">No submissions for selected date</div>
        <div className=\"text-sm\">Select a different date or check back after team members submit their scorecards.</div>
      </div>
    </td>
  </tr>
) : (
  // ... existing rows
)}
```

## SCOPE C — KPI Mapping Alignment

### Dashboard Label Resolution
```typescript
// Create label map from versioned metrics data (uses label_at_submit)
const labelMap = new Map<string, string>();
if (dashboardData?.metrics) {
  dashboardData.metrics.forEach((metric: any) => {
    if (metric.kpi_key && metric.kpi_label) {
      labelMap.set(metric.kpi_key, metric.kpi_label);  // ✅ Uses label_at_submit
    }
  });
}

// Get KPI label from versioned data first, fallback to slug  
const getKpiLabel = (slug: string) => {
  return labelMap.get(slug) || slug;
};
```

### Benefits:
1. **Single Source of Truth**: Dashboard and Targets both use same KPI resolution
2. **Label Consistency**: No more \"Sold Items\" vs \"Policy Sold\" drift
3. **Version Aware**: Labels reflect what was actually submitted, not current definitions

## Acceptance Criteria ✅

- [x] \"Today\" shows rows only when at least one final submission exists today; otherwise empty state
- [x] Switching date picker window changes results accordingly  
- [x] Dashboard labels match Targets for the same KPI (no drift)
- [x] No duplicates for the same tm/date when there was no new submit

## SQL Validation Queries

```sql
-- Count final submissions for today
SELECT COUNT(*) FROM submissions
 WHERE final IS TRUE AND (COALESCE(work_date,submission_date) = CURRENT_DATE);

-- Count dashboard rows for today  
SELECT COUNT(*) FROM get_versioned_dashboard_data('<slug>','Sales',CURRENT_DATE,CURRENT_DATE);
```

These counts should match when there are submissions, and both should be 0 when no submissions exist for the date.

## Visual States

1. **Empty State**: When no submissions exist for selected date, shows friendly message with 📝 icon
2. **Data State**: When submissions exist, shows team member rows with KPI data
3. **Loading State**: Shows spinner while fetching data
4. **Date Picker**: Updates results immediately when date selection changes

The dashboard now correctly filters by actual submission dates and eliminates phantom rows while maintaining KPI label consistency across the system.

# Metrics Email Fix Plan - Complete Implementation Guide

**Created:** 2026-02-03
**Status:** Ready for Implementation
**Scope:** Fix dashboard quotes not appearing in emails + add discrepancy detection

---

## Executive Summary

Three interconnected bugs were discovered:

1. **Emails ignore dashboard data:** `send_submission_feedback` and `send_daily_summary` only read from `submission.payload_json`, ignoring `metrics_daily` which contains dashboard-added quotes.

2. **Form submission overwrites dashboard data:** `upsert_metrics_from_submission` uses `quoted_count = EXCLUDED.quoted_count` which overwrites dashboard-incremented counts instead of preserving the higher value.

3. **No visibility into tracking gaps:** When someone reports more quotes than are tracked with details (e.g., enters "5" on form but only 3 in LQS), there's no indication of this discrepancy.

---

## Verified Schema Facts

### metrics_daily (Wide Table - Confirmed)
```sql
CREATE TABLE public.metrics_daily (
  id uuid PRIMARY KEY,
  agency_id uuid NOT NULL,
  team_member_id uuid NOT NULL,
  date date NOT NULL,
  role app_member_role,
  quoted_count integer DEFAULT 0,      -- ✓ Direct column access works
  sold_items integer DEFAULT 0,         -- ✓ Direct column access works
  custom_kpis JSONB DEFAULT '{}',
  kpi_version_id uuid,
  label_at_submit text,
  ...
  UNIQUE (team_member_id, date)
);
```

### lqs_households (Confirmed)
```sql
CREATE TABLE public.lqs_households (
  id uuid PRIMARY KEY,
  agency_id uuid NOT NULL,
  household_key text NOT NULL,         -- Format: LASTNAME_FIRSTNAME_ZIP
  team_member_id uuid,
  first_quote_date date,               -- Date household was first quoted
  status text CHECK (status IN ('lead', 'quoted', 'sold')),
  ...
  UNIQUE (agency_id, household_key)    -- One row per household per agency
);
```

### quoted_household_details (Confirmed)
```sql
CREATE TABLE public.quoted_household_details (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL,
  agency_id uuid,
  team_member_id uuid,
  work_date date,
  household_name text,
  zip_code text,
  ...
);
```

### Trigger Execution Order (Same Transaction)
1. `trg_after_submission_upsert` → `upsert_metrics_from_submission()` → sets `metrics_daily`
2. `trigger_flatten_quoted_details_enhanced` → inserts `quoted_household_details`
3. `quoted_household_details_sync_to_lqs` → upserts `lqs_households`

---

## Implementation Details

### Change 1: Database Migration - MAX Logic for Metrics

**File:** `supabase/migrations/YYYYMMDDHHMMSS_fix_metrics_max_quoted_sold.sql`

**Purpose:** Prevent form submission from overwriting higher dashboard counts.

```sql
-- ============================================================================
-- Fix: Use GREATEST() to preserve dashboard-added quotes/sales
--
-- Problem: Form submission overwrites metrics_daily.quoted_count with payload
--          value, destroying dashboard-added quotes.
-- Solution: Use GREATEST(existing, new) so higher value wins.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_metrics_from_submission(
  p_submission uuid,
  p_kpi_version_id uuid DEFAULT NULL,
  p_label_at_submit text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- [All existing DECLARE variables remain unchanged]
  s record;
  role_txt app_member_role;
  rules record;
  settings jsonb;
  oc int; tm int; qc int; qe text; si int; sp int; sp_cents int; so int;
  csu int; mr int;
  the_date date;
  counted jsonb;
  count_if_submit boolean;
  tmap jsonb;
  w_out int; w_talk int; w_quoted int; w_items int; w_pols int; w_prem int; w_csu int; w_mr int;
  sel text[];
  nreq int;
  hits int := 0;
  score int := 0;
  pass bool := false;
  late bool := false;
  allow_late boolean := false;
  agency_id uuid;
  wd int;
  flag boolean;
  v_kpi_version_id uuid;
  v_label_at_submit text;
  v_custom_kpis JSONB := '{}';
  v_form_schema JSONB;
  v_kpi_elem JSONB;
  v_payload_key TEXT;
  v_stripped_key TEXT;
  v_selected_kpi_slug TEXT;
  v_selected_kpi_id UUID;
  v_kpi_db_key TEXT;
  v_kpi_value NUMERIC;
BEGIN
  -- [All existing SELECT INTO and logic remains unchanged through line ~297]
  -- ... (copy all existing logic up to the INSERT statement)

  -- ============================================================================
  -- MODIFIED: Upsert with GREATEST() for quoted_count and sold_items
  -- ============================================================================
  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    outbound_calls, talk_minutes, quoted_count, quoted_entity,
    sold_items, sold_policies, sold_premium_cents,
    cross_sells_uncovered, mini_reviews,
    custom_kpis,
    is_counted_day, is_late, hits, daily_score, pass,
    final_submission_id, submitted_at,
    kpi_version_id, label_at_submit
  )
  VALUES (
    agency_id, s.tm_id, the_date, role_txt,
    oc, tm, qc, qe,
    si, so, sp_cents,
    csu, mr,
    v_custom_kpis,
    flag, late, hits, score, pass,
    p_submission, now(),
    v_kpi_version_id, v_label_at_submit
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    role = EXCLUDED.role,
    outbound_calls = EXCLUDED.outbound_calls,
    talk_minutes = EXCLUDED.talk_minutes,
    -- CRITICAL FIX: Use GREATEST to preserve dashboard-added counts
    quoted_count = GREATEST(COALESCE(metrics_daily.quoted_count, 0), EXCLUDED.quoted_count),
    quoted_entity = EXCLUDED.quoted_entity,
    -- CRITICAL FIX: Use GREATEST to preserve dashboard-added counts
    sold_items = GREATEST(COALESCE(metrics_daily.sold_items, 0), EXCLUDED.sold_items),
    sold_policies = EXCLUDED.sold_policies,
    sold_premium_cents = EXCLUDED.sold_premium_cents,
    cross_sells_uncovered = EXCLUDED.cross_sells_uncovered,
    mini_reviews = EXCLUDED.mini_reviews,
    custom_kpis = EXCLUDED.custom_kpis,
    is_counted_day = EXCLUDED.is_counted_day,
    is_late = EXCLUDED.is_late,
    hits = EXCLUDED.hits,
    daily_score = EXCLUDED.daily_score,
    pass = EXCLUDED.pass,
    final_submission_id = EXCLUDED.final_submission_id,
    submitted_at = EXCLUDED.submitted_at,
    kpi_version_id = EXCLUDED.kpi_version_id,
    label_at_submit = EXCLUDED.label_at_submit,
    updated_at = now();

  PERFORM recompute_streaks_for_member(s.tm_id, the_date - 30, the_date);
END;
$function$;
```

---

### Change 2: Database Migration - Add Index for Batch Query

**File:** Same migration file as Change 1

```sql
-- ============================================================================
-- Add index for efficient batch counting of tracked households
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lqs_households_tracked_count
  ON lqs_households(agency_id, first_quote_date, team_member_id)
  WHERE status IN ('quoted', 'sold');

COMMENT ON INDEX idx_lqs_households_tracked_count IS
  'Supports batch counting of tracked households for discrepancy detection in emails';
```

---

### Change 3: Update send_submission_feedback Edge Function

**File:** `supabase/functions/send_submission_feedback/index.ts`

#### 3a. Add type definitions (after line 40)

```typescript
// ========== Discrepancy Detection Types ==========
interface PerformanceMetric {
  metric: string;
  actual: number;
  target: number;
  passed: boolean;
  percentage: number;
  hasDiscrepancy?: boolean;
  trackedCount?: number | null;
  discrepancyNote?: string;
}

// KPIs eligible for discrepancy detection (have tracking tables)
const DISCREPANCY_ELIGIBLE_KPIS = ['quoted_households', 'quoted_count'];
```

#### 3b. Query tracking data after submission fetch (after line 168)

```typescript
    // ========== ADDED: Get metrics_daily for source of truth ==========
    const workDate = submission.work_date || submission.submission_date;

    const { data: metricsDaily } = await supabase
      .from('metrics_daily')
      .select('quoted_count, sold_items')
      .eq('team_member_id', submission.team_member_id)
      .eq('date', workDate)
      .eq('agency_id', formTemplate.agency_id)
      .single();

    logStructured('info', 'metrics_daily_loaded', {
      request_id: requestId,
      quoted_count: metricsDaily?.quoted_count,
      sold_items: metricsDaily?.sold_items
    });

    // ========== ADDED: Get tracked household count for discrepancy detection ==========
    // Use quoted_household_details for immediate email (same transaction, guaranteed committed)
    // This avoids sync lag issues with lqs_households
    const { count: trackedQuotedCount } = await supabase
      .from('quoted_household_details')
      .select('*', { count: 'exact', head: true })
      .eq('team_member_id', submission.team_member_id)
      .eq('agency_id', formTemplate.agency_id)
      .eq('work_date', workDate);

    // Also check lqs_households for dashboard-added entries
    const { count: lqsTrackedCount } = await supabase
      .from('lqs_households')
      .select('*', { count: 'exact', head: true })
      .eq('team_member_id', submission.team_member_id)
      .eq('agency_id', formTemplate.agency_id)
      .eq('first_quote_date', workDate)
      .in('status', ['quoted', 'sold']);

    // Use MAX of both sources to avoid false positives from sync timing
    const totalTrackedQuotes = Math.max(trackedQuotedCount || 0, lqsTrackedCount || 0);

    logStructured('info', 'tracked_counts_loaded', {
      request_id: requestId,
      quoted_household_details_count: trackedQuotedCount,
      lqs_households_count: lqsTrackedCount,
      total_tracked: totalTrackedQuotes
    });
```

#### 3c. Modify performance data generation (replace lines 254-286)

```typescript
    // 6. Build performance data with discrepancy detection
    const payload = submission.payload_json || {};
    const kpis = formTemplate.schema_json?.kpis || [];

    const performanceData: PerformanceMetric[] = [];

    for (const kpi of kpis) {
      const kpiSlug = kpi.selectedKpiSlug || '';
      const kpiKey = kpi.key || '';
      const normalizedKey = normalizeMetricKey(kpiSlug || kpiKey);

      let actual: number;
      let hasDiscrepancy = false;
      let trackedCount: number | null = null;
      let discrepancyNote: string | undefined;

      // For quoted_households: prefer metrics_daily (includes dashboard) over payload
      if (normalizedKey === 'quoted_households') {
        actual = metricsDaily?.quoted_count ?? 0;

        // Fall back to payload if metrics_daily is empty/missing
        if (actual === 0) {
          const payloadResult = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
          actual = payloadResult.value;
        }

        // Discrepancy detection for quoted_households
        trackedCount = totalTrackedQuotes;
        if (actual > trackedCount) {
          hasDiscrepancy = true;
          const missing = actual - trackedCount;
          discrepancyNote = `${missing} household${missing > 1 ? 's' : ''} not tracked with details`;
        }

        logStructured('info', 'quoted_households_resolved', {
          request_id: requestId,
          actual,
          trackedCount,
          hasDiscrepancy,
          source: metricsDaily?.quoted_count ? 'metrics_daily' : 'payload'
        });

      } else if (normalizedKey === 'items_sold') {
        // For items_sold: prefer metrics_daily over payload
        actual = metricsDaily?.sold_items ?? 0;

        if (actual === 0) {
          const payloadResult = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
          actual = payloadResult.value;
        }
        // Note: Could add lqs_sales discrepancy detection here in future

      } else {
        // All other KPIs: use payload directly (no aggregation source)
        const actualResult = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
        actual = actualResult.value;
      }

      // Get target value (unchanged logic)
      const targetResult = getTargetValue(targetsMap, kpiSlug, kpiKey, kpi.target?.goal);
      const target = targetResult.value;
      const percentage = target > 0 ? Math.round((actual / target) * 100) : 100;

      logStructured('info', 'kpi_resolution', {
        request_id: requestId,
        label: kpi.label,
        selectedKpiSlug: kpiSlug,
        key: kpiKey,
        normalizedKey,
        actual,
        target,
        percentage,
        hasDiscrepancy,
        trackedCount
      });

      performanceData.push({
        metric: kpi.label,
        actual,
        target,
        passed: actual >= target,
        percentage,
        hasDiscrepancy,
        trackedCount,
        discrepancyNote
      });
    }

    // ========== ADDED: Include metrics not in form but tracked in metrics_daily ==========
    const quotedInForm = kpis.some((k: any) => {
      const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
      return normalized === 'quoted_households';
    });

    if (!quotedInForm && metricsDaily?.quoted_count && metricsDaily.quoted_count > 0) {
      const quotedTarget = getTargetValue(targetsMap, 'quoted_households', 'quoted_count', undefined);
      const hasDiscrepancy = metricsDaily.quoted_count > totalTrackedQuotes;
      const missing = metricsDaily.quoted_count - totalTrackedQuotes;

      performanceData.push({
        metric: 'Quoted Households',
        actual: metricsDaily.quoted_count,
        target: quotedTarget.value,
        passed: quotedTarget.value > 0 ? metricsDaily.quoted_count >= quotedTarget.value : true,
        percentage: quotedTarget.value > 0 ? Math.round((metricsDaily.quoted_count / quotedTarget.value) * 100) : 100,
        hasDiscrepancy,
        trackedCount: totalTrackedQuotes,
        discrepancyNote: hasDiscrepancy ? `${missing} household${missing > 1 ? 's' : ''} not tracked with details` : undefined
      });

      logStructured('info', 'quoted_households_added_from_metrics', {
        request_id: requestId,
        actual: metricsDaily.quoted_count,
        trackedCount: totalTrackedQuotes,
        hasDiscrepancy
      });
    }

    // Same pattern for sold_items if not in form
    const soldInForm = kpis.some((k: any) => {
      const normalized = normalizeMetricKey(k.selectedKpiSlug || k.key || '');
      return normalized === 'items_sold';
    });

    if (!soldInForm && metricsDaily?.sold_items && metricsDaily.sold_items > 0) {
      const soldTarget = getTargetValue(targetsMap, 'items_sold', 'sold_items', undefined);

      performanceData.push({
        metric: 'Items Sold',
        actual: metricsDaily.sold_items,
        target: soldTarget.value,
        passed: soldTarget.value > 0 ? metricsDaily.sold_items >= soldTarget.value : true,
        percentage: soldTarget.value > 0 ? Math.round((metricsDaily.sold_items / soldTarget.value) * 100) : 100,
        hasDiscrepancy: false,
        trackedCount: null
      });
    }
```

#### 3d. Update email HTML generation to show discrepancy (modify statsTable call)

In the `_shared/email-template.ts` or inline, update the stats table generation:

```typescript
    // Build stats rows with discrepancy indicators
    const statsRows = performanceData.map(p => {
      // Discrepancy indicator: asterisk for email compatibility + warning emoji
      const discrepancyIndicator = p.hasDiscrepancy ? '*' : '';

      return `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
          ${p.metric}${discrepancyIndicator}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.actual}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.target}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${p.passed ? '#22c55e' : '#ef4444'};">
          ${p.passed ? '✅' : '❌'} ${p.percentage}%
        </td>
      </tr>`;
    }).join('');

    // Build discrepancy footnotes
    const discrepancies = performanceData.filter(p => p.hasDiscrepancy && p.discrepancyNote);
    const footnoteHtml = discrepancies.length > 0 ? `
      <div style="margin-top: 16px; padding: 12px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">⚠️ Tracking Gaps Detected</p>
        <ul style="margin: 0; padding-left: 20px; color: #92400e;">
          ${discrepancies.map(d => `<li>* ${d.metric}: ${d.discrepancyNote}</li>`).join('')}
        </ul>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #a16207;">
          Add households via Dashboard for complete tracking and follow-up.
        </p>
      </div>
    ` : '';
```

---

### Change 4: Update send_daily_summary Edge Function

**File:** `supabase/functions/send_daily_summary/index.ts`

#### 4a. Add batch query for tracked counts (after line 219, inside the form loop)

```typescript
        // ========== ADDED: Batch query for tracked household counts ==========
        // For daily summary, use lqs_households (end of day, all syncs complete)
        const { data: trackedCounts } = await supabase
          .from('lqs_households')
          .select('team_member_id')
          .eq('agency_id', agency.id)
          .eq('first_quote_date', yesterdayStr)
          .in('status', ['quoted', 'sold']);

        // Build map: team_member_id -> tracked count
        const trackedCountMap: Record<string, number> = {};
        trackedCounts?.forEach(row => {
          trackedCountMap[row.team_member_id] = (trackedCountMap[row.team_member_id] || 0) + 1;
        });

        logStructured('tracked_counts_loaded', {
          formId: form.id,
          trackedMembersCount: Object.keys(trackedCountMap).length
        });
```

#### 4b. Query metrics_daily for each team member (modify the member loop around line 231)

```typescript
        // ========== ADDED: Batch query metrics_daily ==========
        const { data: metricsData } = await supabase
          .from('metrics_daily')
          .select('team_member_id, quoted_count, sold_items')
          .eq('agency_id', agency.id)
          .eq('date', yesterdayStr);

        const metricsMap: Record<string, { quoted_count: number; sold_items: number }> = {};
        metricsData?.forEach(row => {
          metricsMap[row.team_member_id] = {
            quoted_count: row.quoted_count || 0,
            sold_items: row.sold_items || 0
          };
        });
```

#### 4c. Use metrics_daily values in KPI resolution (modify the memberKpis map)

```typescript
        for (const member of teamMembers || []) {
          const submission = submissionsByMember.get(member.id);
          const memberMetrics = metricsMap[member.id];
          const trackedQuotes = trackedCountMap[member.id] || 0;

          if (submission || memberMetrics) {
            const payload = submission?.payload_json || {};

            const memberKpis = kpis.map((kpi: any) => {
              const kpiSlug = kpi.selectedKpiSlug || '';
              const kpiKey = kpi.key || '';
              const normalizedKey = normalizeMetricKey(kpiSlug || kpiKey);

              let actual: number;
              let hasDiscrepancy = false;
              let trackedCount: number | null = null;

              // For quoted_households: prefer metrics_daily
              if (normalizedKey === 'quoted_households') {
                actual = memberMetrics?.quoted_count ?? getMetricValueFromPayload(payload, kpiSlug, kpiKey);
                trackedCount = trackedQuotes;
                hasDiscrepancy = actual > trackedCount;
              } else if (normalizedKey === 'items_sold') {
                actual = memberMetrics?.sold_items ?? getMetricValueFromPayload(payload, kpiSlug, kpiKey);
              } else {
                actual = getMetricValueFromPayload(payload, kpiSlug, kpiKey);
              }

              const target = getTargetValue(targetsMap, kpiSlug, kpiKey, kpi.target?.goal);

              return {
                metric: kpi.label || kpiSlug || kpiKey || 'Unknown',
                actual,
                target,
                passed: actual >= target,
                hasDiscrepancy,
                trackedCount
              };
            });

            // ... rest of existing logic
          }
        }
```

---

### Change 5: Update Shared Email Template

**File:** `supabase/functions/_shared/email-template.ts`

Add support for discrepancy indicators in `EmailComponents.statsTable`:

```typescript
export const EmailComponents = {
  // ... existing methods ...

  statsTable: (data: Array<{
    metric: string;
    actual: number;
    target: number;
    passed: boolean;
    percentage: number;
    hasDiscrepancy?: boolean;
    discrepancyNote?: string;
  }>) => {
    const rows = data.map(p => {
      const indicator = p.hasDiscrepancy ? '*' : '';
      const passColor = p.passed ? '#22c55e' : '#ef4444';
      const passIcon = p.passed ? '✓' : '✗';

      return `<tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${p.metric}${indicator}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.actual}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.target}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${passColor}; font-weight: 600;">
          ${passIcon} ${p.percentage}%
        </td>
      </tr>`;
    }).join('');

    const discrepancies = data.filter(d => d.hasDiscrepancy && d.discrepancyNote);
    const footnote = discrepancies.length > 0 ? `
      <div style="margin-top: 16px; padding: 12px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; font-size: 13px;">
          ⚠ Tracking Gaps Detected
        </p>
        <ul style="margin: 0; padding-left: 16px; color: #a16207; font-size: 12px;">
          ${discrepancies.map(d => `<li>* ${d.metric}: ${d.discrepancyNote}</li>`).join('')}
        </ul>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #a16207;">
          Add households via Dashboard for complete tracking.
        </p>
      </div>
    ` : '';

    return `
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px 8px; text-align: left; font-weight: 600; font-size: 13px;">Metric</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 13px;">Actual</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 13px;">Target</th>
            <th style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 13px;">Result</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${footnote}
    `;
  },

  // ... rest of existing methods ...
};
```

---

## Testing Plan

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

### Test 5: Daily Summary Includes Dashboard Quotes
1. Multiple team members with dashboard quotes
2. Trigger daily summary (`send_daily_summary`)
3. **Expected:** Team totals include dashboard-added quotes
4. **Expected:** Discrepancy indicators appear where applicable

### Test 6: All Roles Subject to Discrepancy (Including Manager)
1. Manager submits scorecard with `quoted_households = 3`
2. Manager has 0 tracked households in LQS
3. **Expected:** Email shows "3*" with discrepancy footnote
4. **Rationale:** No role is exempt - enforces discipline for all staff

### Test 7: Hybrid Role Works Correctly
1. Hybrid staff submits Sales scorecard
2. Has dashboard quotes from earlier in day
3. **Expected:** Dashboard quotes included, discrepancy detection works

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/YYYYMMDDHHMMSS_fix_metrics_max_quoted_sold.sql` | CREATE | GREATEST logic + index |
| `supabase/functions/send_submission_feedback/index.ts` | MODIFY | Query metrics_daily, discrepancy logic |
| `supabase/functions/send_daily_summary/index.ts` | MODIFY | Batch queries, discrepancy logic |
| `supabase/functions/_shared/email-template.ts` | MODIFY | Discrepancy indicator styling |

---

## Rollback Plan

### Database
```sql
-- Revert to original EXCLUDED (overwrite) behavior
-- Run the original upsert_metrics_from_submission function from git history

-- Remove new index if needed
DROP INDEX IF EXISTS idx_lqs_households_tracked_count;
```

### Edge Functions
```bash
# Redeploy previous versions from git history
git checkout HEAD~1 -- supabase/functions/send_submission_feedback/index.ts
git checkout HEAD~1 -- supabase/functions/send_daily_summary/index.ts
git checkout HEAD~1 -- supabase/functions/_shared/email-template.ts

# Deploy
supabase functions deploy send_submission_feedback
supabase functions deploy send_daily_summary
```

---

## Key Design Decisions

1. **MAX logic (GREATEST):** Prevents data loss when form value is lower than dashboard count. Tradeoff: accidental high entries "stick" until manually corrected.

2. **Discrepancy detection for ALL roles:** Including Manager - enforces discipline. No one can "just submit" without paying attention to details.

3. **Use `quoted_household_details` for immediate email:** Avoids sync lag with `lqs_households`. Use `lqs_households` for daily summary where timing is not an issue.

4. **Asterisk + footnote for email compatibility:** Some clients strip emoji. Asterisk works everywhere.

5. **Only `quoted_households` gets discrepancy detection:** Other KPIs don't have tracking tables. Custom KPIs are excluded.

6. **Status filter `IN ('quoted', 'sold')`:** Leads are not counted as quoted households.

---

## Performance Considerations

1. **Batch queries for daily summary:** GROUP BY `team_member_id` instead of N+1 queries per member.

2. **New index:** `idx_lqs_households_tracked_count` supports efficient batch counting.

3. **Service role client:** Already used in email functions - no RLS overhead.

---

## Future Enhancements

1. **Items Sold discrepancy:** Add `lqs_sales` count comparison when that tracking matures.

2. **Manual correction UI:** Dashboard to adjust `metrics_daily` values when MAX logic preserved incorrect data.

3. **Agency-level settings:** Option to exempt specific roles from discrepancy flags (not implemented per user request).

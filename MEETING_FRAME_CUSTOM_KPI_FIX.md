# Meeting Frame Custom KPI Fix

## Problem Summary

Custom KPIs created by agencies (e.g., "GFN", "Renewals" for Service team) show as **0** in Meeting Frame reports even though submissions contain actual values.

**Affected Users Example:**
- Lisa (Manager) viewing Kim Zavala and Juliana Esquivel (Service team) in Mayra Menchaca Agency
- Kim's Jan 27 submission has `custom_kpi_5_renewals: 15` but Meeting Frame shows 0

**Also Affects:** TeamPerformanceRings.tsx (Team Rings view)

## Root Cause

The `metrics_daily` table only has **hardcoded columns** for standard KPIs:
```
outbound_calls, talk_minutes, quoted_count, sold_items, 
sold_policies, sold_premium_cents, cross_sells_uncovered, mini_reviews
```

The `upsert_metrics_from_submission` function only extracts these standard fields from `payload_json`, completely ignoring any `custom_kpi_*` fields.

**Data Flow Gap:**
```
Form submission → payload_json has custom_kpi_5_renewals: 15
                           ↓
upsert_metrics_from_submission → IGNORES custom fields
                           ↓
metrics_daily → No column for custom KPIs → Data lost
                           ↓
Meeting Frame / Team Rings → Reads metrics_daily → Shows 0
```

## Key Mapping Challenge

| Location | Key Format | Example |
|----------|------------|---------|
| `kpis.key` | timestamp-based | `custom_1769616315662` |
| `payload_json` | index-based | `custom_kpi_5_renewals` |
| `form_template.schema_json.kpis[].key` | matches payload | `custom_kpi_5_renewals` |
| `form_template.schema_json.kpis[].selectedKpiId` | UUID | links to `kpis.id` |

The **only link** between `kpis.key` and `payload_json` is through the form template's schema.

---

## Critical Discovery: Component Differences

**MeetingFrameTab.tsx** has full KPI objects:
```typescript
displayKpis.map((kpi) => {
  // kpi has: id, key, label, type
  getMetricValue(row, kpi.key);  // Could pass kpi.id
});
```

**TeamPerformanceRings.tsx** only has metric key strings:
```typescript
normalizedMetrics.map((metricKey: string) => {
  // Only has the key string, NOT full KPI object
  getMetricValue(member, metricKey);  // Cannot pass kpi.id!
});
```

This means we **cannot require kpi.id as a parameter** without major refactoring of TeamPerformanceRings.

---

## Solution: Store by kpis.key (not UUID)

**Simpler approach that works for both components:**

1. In `upsert_metrics_from_submission`:
   - Get `selectedKpiId` (UUID) from form schema  
   - Look up `kpis.key` from `kpis` table using that UUID
   - Store in `custom_kpis` as: `{ "custom_1769616315662": value }`

2. In `getMetricValue`:
   - When `kpiKey.startsWith('custom_')`, check `data.custom_kpis[kpiKey]`
   - **No function signature change needed!**

3. **No changes to MeetingFrameTab.tsx or TeamPerformanceRings.tsx!**

---

## Files to Modify

| File | Action |
|------|--------|
| `supabase/migrations/[timestamp]_add_custom_kpis_column.sql` | CREATE |
| `supabase/migrations/[timestamp]_upsert_metrics_custom_kpis.sql` | CREATE |
| `supabase/migrations/[timestamp]_backfill_custom_kpis.sql` | CREATE |
| `src/lib/kpiKeyMapping.ts` | MODIFY getMetricValue (lines 123-148) |
| ~~`src/components/agency/MeetingFrameTab.tsx`~~ | NO CHANGE NEEDED |
| ~~`src/components/rings/TeamPerformanceRings.tsx`~~ | NO CHANGE NEEDED |

---

## Implementation

### Step 1: Migration - Add custom_kpis Column

**File:** `supabase/migrations/[timestamp]_add_custom_kpis_column.sql`

```sql
-- Add JSONB column to store custom KPI values
-- Format: { "kpis.key": numeric_value, ... }
-- Example: { "custom_1769616315662": 15, "custom_1769554851688": 180 }
ALTER TABLE public.metrics_daily 
ADD COLUMN IF NOT EXISTS custom_kpis JSONB DEFAULT '{}';

-- Add index for JSONB queries if needed later
CREATE INDEX IF NOT EXISTS idx_metrics_daily_custom_kpis 
ON public.metrics_daily USING gin (custom_kpis);

COMMENT ON COLUMN public.metrics_daily.custom_kpis IS 
'Stores custom KPI values keyed by kpis.key (e.g., custom_1769616315662). Values are numeric.';
```

---

### Step 2: Migration - Update upsert_metrics_from_submission

**File:** `supabase/migrations/[timestamp]_upsert_metrics_custom_kpis.sql`

**CRITICAL INSTRUCTIONS FOR CLAUDE CODE:**
1. Get the FULL existing function from `supabase/migrations/20251211163209_690feef3-7669-4372-90d9-c0568194bd58.sql`
2. Copy it EXACTLY
3. Add ONLY the following changes:
   - New variables in DECLARE block (after `v_label_at_submit text;`)
   - Custom KPI extraction block after `mr := _nz_int(s.p->'mini_reviews');`
   - Add `custom_kpis` to INSERT columns and VALUES
   - Add `custom_kpis = EXCLUDED.custom_kpis` to ON CONFLICT SET clause

**New variables to add to DECLARE block (after `v_label_at_submit text;`):**
```sql
  -- Custom KPI variables
  v_custom_kpis JSONB := '{}';
  v_form_schema JSONB;
  v_kpi_elem JSONB;
  v_payload_key TEXT;
  v_selected_kpi_id UUID;
  v_kpi_db_key TEXT;
  v_kpi_value NUMERIC;
```

**Custom KPI extraction block to add after standard field extraction (after `mr := _nz_int(s.p->'mini_reviews');`):**
```sql
  -- ============================================
  -- Extract custom KPI values from payload
  -- Maps form payload keys to kpis.key for storage
  -- ============================================
  BEGIN
    -- Get form template schema for this submission
    SELECT ft.schema_json INTO v_form_schema
    FROM form_templates ft
    WHERE ft.id = s.template_id;

    -- If we have a schema with KPIs, extract custom values
    IF v_form_schema IS NOT NULL AND v_form_schema->'kpis' IS NOT NULL THEN
      FOR v_kpi_elem IN SELECT * FROM jsonb_array_elements(v_form_schema->'kpis')
      LOOP
        v_payload_key := v_kpi_elem->>'key';
        v_selected_kpi_id := (v_kpi_elem->>'selectedKpiId')::uuid;
        
        -- Only process custom KPIs (payload keys starting with 'custom_kpi_')
        IF v_payload_key IS NOT NULL 
           AND v_payload_key LIKE 'custom_kpi_%' 
           AND v_selected_kpi_id IS NOT NULL THEN
          
          -- Look up the actual kpis.key from the kpis table
          SELECT k.key INTO v_kpi_db_key
          FROM kpis k
          WHERE k.id = v_selected_kpi_id;
          
          IF v_kpi_db_key IS NOT NULL THEN
            -- Get value from payload using the form field key
            v_kpi_value := COALESCE((s.p->>v_payload_key)::numeric, 0);
            
            -- Store in custom_kpis using kpis.key (e.g., "custom_1769616315662")
            v_custom_kpis := v_custom_kpis || jsonb_build_object(v_kpi_db_key, v_kpi_value);
          END IF;
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail - custom KPIs are supplementary
    RAISE WARNING 'Error extracting custom KPIs for submission %: %', p_submission, SQLERRM;
    v_custom_kpis := '{}';
  END;
```

**Modify INSERT statement - add `custom_kpis` column:**

Change FROM:
```sql
    INSERT INTO metrics_daily (
      agency_id, team_member_id, date, role,
      outbound_calls, talk_minutes, quoted_count, quoted_entity,
      sold_items, sold_policies, sold_premium_cents,
      cross_sells_uncovered, mini_reviews,
      is_counted_day, is_late, hits, daily_score, pass,
```

TO:
```sql
    INSERT INTO metrics_daily (
      agency_id, team_member_id, date, role,
      outbound_calls, talk_minutes, quoted_count, quoted_entity,
      sold_items, sold_policies, sold_premium_cents,
      cross_sells_uncovered, mini_reviews,
      custom_kpis,
      is_counted_day, is_late, hits, daily_score, pass,
```

Change VALUES FROM:
```sql
    VALUES (
      agency_id, s.tm_id, the_date, role_txt,
      oc, tm, qc, qe,
      si, so, sp_cents,
      csu, mr,
      flag, late, hits, score, pass,
```

TO:
```sql
    VALUES (
      agency_id, s.tm_id, the_date, role_txt,
      oc, tm, qc, qe,
      si, so, sp_cents,
      csu, mr,
      v_custom_kpis,
      flag, late, hits, score, pass,
```

**Modify ON CONFLICT - add to SET clause (after `mini_reviews = EXCLUDED.mini_reviews,`):**
```sql
      custom_kpis = EXCLUDED.custom_kpis,
```

---

### Step 3: Update getMetricValue

**File:** `src/lib/kpiKeyMapping.ts` (lines 123-148)

**Add this check at the VERY START of the function, before the aliases check:**

```typescript
export function getMetricValue(data: Record<string, any>, kpiKey: string): number {
  // For custom KPIs, check custom_kpis JSONB first
  if (kpiKey.startsWith('custom_') && data.custom_kpis) {
    const customValue = data.custom_kpis[kpiKey];
    if (customValue !== undefined && customValue !== null) {
      return Number(customValue) || 0;
    }
    // If not found in custom_kpis, continue to standard fallback checks
  }

  // Get the list of aliases to try for this key
  const aliases = KEY_ALIASES[kpiKey];

  if (aliases) {
    // Try each alias in order until we find a value
    for (const alias of aliases) {
      if (data[alias] !== undefined && data[alias] !== null) {
        return Number(data[alias]) || 0;
      }
    }
  }

  // No aliases defined, try direct access
  if (data[kpiKey] !== undefined && data[kpiKey] !== null) {
    return Number(data[kpiKey]) || 0;
  }

  // Fallback to database column name (legacy data)
  const column = toColumn(kpiKey);
  if (column !== kpiKey && data[column] !== undefined && data[column] !== null) {
    return Number(data[column]) || 0;
  }

  return 0;
}
```

**Key change:** Added custom_kpis check at the start. **NO signature change** - function still takes `(data, kpiKey)`.

---

### Step 4: Backfill Migration

**File:** `supabase/migrations/[timestamp]_backfill_custom_kpis.sql`

```sql
-- Backfill custom_kpis for existing submissions
-- Run this AFTER the function update is deployed

DO $$
DECLARE
  v_submission RECORD;
  v_count INT := 0;
  v_error_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting custom_kpis backfill...';
  
  -- Find all final submissions that have custom KPIs in their form schema
  FOR v_submission IN 
    SELECT DISTINCT s.id, s.work_date
    FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.final = true
    AND ft.schema_json->'kpis' IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(ft.schema_json->'kpis') elem
      WHERE elem->>'key' LIKE 'custom_kpi_%'
      AND elem->>'selectedKpiId' IS NOT NULL
    )
    ORDER BY s.work_date DESC
  LOOP
    BEGIN
      -- Re-run upsert to populate custom_kpis
      PERFORM upsert_metrics_from_submission(v_submission.id);
      v_count := v_count + 1;
      
      IF v_count % 100 = 0 THEN
        RAISE NOTICE 'Processed % submissions...', v_count;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING 'Error processing submission %: %', v_submission.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete. Processed: %, Errors: %', v_count, v_error_count;
END $$;
```

---

## Risk Analysis

### What This Change Affects

| Component | Risk Level | Notes |
|-----------|------------|-------|
| metrics_daily table | **LOW** | Adding column with DEFAULT doesn't affect existing rows |
| upsert_metrics_from_submission | **MEDIUM** | Wrapped in exception handler - failures logged but don't block |
| getMetricValue() | **LOW** | Same signature - no call site changes needed |
| MeetingFrameTab.tsx | **NONE** | No changes |
| TeamPerformanceRings.tsx | **NONE** | No changes |

### What Could Break

1. **If upsert_metrics_from_submission fails entirely:**
   - Mitigation: Custom KPI extraction is wrapped in BEGIN/EXCEPTION
   - Fallback: Standard metrics still save, only custom_kpis would be empty

2. **If getMetricValue returns wrong values:**
   - Mitigation: Custom KPI path only triggers when `kpiKey.startsWith('custom_')` 
   - Standard KPIs follow exact same path as before (unchanged)

3. **If kpis table lookup fails:**
   - Mitigation: NULL check before storing - silently skips if kpi not found
   - Standard metrics unaffected

### Rollback Plan

If issues occur:
```sql
-- 1. Remove custom_kpis column
ALTER TABLE metrics_daily DROP COLUMN IF EXISTS custom_kpis;

-- 2. Restore original function (redeploy previous migration)
```

And revert `src/lib/kpiKeyMapping.ts` to remove the custom_kpis check.

---

## Verification Steps

### After Deployment

```sql
-- 1. Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'metrics_daily' AND column_name = 'custom_kpis';

-- 2. Check if custom_kpis are being populated for new submissions
SELECT 
  md.date,
  tm.name as team_member,
  md.custom_kpis,
  md.outbound_calls,
  md.talk_minutes
FROM metrics_daily md
JOIN team_members tm ON tm.id = md.team_member_id
WHERE md.custom_kpis != '{}'
ORDER BY md.date DESC
LIMIT 10;

-- 3. Verify the key format is correct (should be kpis.key like "custom_1769616315662")
SELECT 
  md.date,
  jsonb_object_keys(md.custom_kpis) as kpi_key,
  md.custom_kpis
FROM metrics_daily md
WHERE md.custom_kpis != '{}'
LIMIT 5;

-- 4. Verify Kim Zavala's data after backfill
SELECT 
  md.date,
  md.custom_kpis,
  s.payload_json
FROM metrics_daily md
JOIN team_members tm ON tm.id = md.team_member_id
LEFT JOIN submissions s ON s.id = md.final_submission_id
WHERE tm.name = 'Kim Zavala'
AND md.date >= '2026-01-27'
ORDER BY md.date DESC;
```

### Manual Testing

1. Sign in as Lisa (Manager) in Mayra Menchaca Agency
2. Go to Meeting Frame
3. Select Kim Zavala or Juliana Esquivel
4. Set date range including Jan 27, 2026
5. Generate report
6. Verify rings show actual values (not 0)

Also test Team Rings:
1. Go to Team Rings page
2. Verify custom KPIs show values (not 0)

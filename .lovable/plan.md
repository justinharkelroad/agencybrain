
# Fix: Email Reports Showing 0s for Custom KPIs

## Problem Summary

The Daily Performance Report emails for Kyle MACVICAR's agency (and likely others using custom KPIs) show **0 values** for "Life Lead Uncovered" and "P&C Lead Uncovered" even though the actual submissions have data.

## Root Cause

There's a **key naming mismatch** between how form submissions store data and how email functions look it up:

| Layer | Key Used |
|-------|----------|
| **Form Schema** `kpi.key` | `preselected_kpi_2_cross_sells_uncovered` |
| **Form Schema** `selectedKpiSlug` | `custom_1769804996319` |
| **Submission Payload** | `cross_sells_uncovered` (after stripping prefix) |
| **Email Lookup** | Tries `custom_...` then `preselected_...` → **Neither found!** |

The submission edge functions (`submit_public_form`, `staff_submit_form`) intentionally strip the `preselected_kpi_N_` prefix from keys:

```typescript
// Lines 191-198 in submit_public_form/index.ts
for (const key of Object.keys(v)) {
  if (/^preselected_kpi_\d+_/.test(key)) {
    const nk = key.replace(/^preselected_kpi_\d+_/, '');  // "cross_sells_uncovered"
    v[nk] = v[key];
    delete v[key];
  }
}
```

But the email functions don't apply the same stripping logic when looking up values - they try the raw `kpi.key` which still has the prefix.

## Proof from Database

**Actual submission payload for Liz Flack:**
```json
{
  "cross_sells_uncovered": 1,   // ← Data IS here!
  "mini_reviews": 1,            // ← Data IS here!
  "outbound_calls": 30,
  "talk_minutes": 150
}
```

**Form schema lookup keys:**
- `selectedKpiSlug`: `custom_1769804996319`
- `kpi.key`: `preselected_kpi_2_cross_sells_uncovered`

Neither of these matches `cross_sells_uncovered` in the payload.

---

## Solution

Update the `getMetricValueFromPayload` function in both email edge functions to also try the **stripped version** of `kpi.key`:

### Files to Update

| File | Change |
|------|--------|
| `supabase/functions/send_submission_feedback/index.ts` | Add stripped key fallback |
| `supabase/functions/send_daily_summary/index.ts` | Add stripped key fallback |

### Code Change

In both files, update `getMetricValueFromPayload` to add a step that strips the `preselected_kpi_N_` prefix:

```typescript
function getMetricValueFromPayload(
  payload: Record<string, any>, 
  kpiSlug: string, 
  kpiKey: string
): { value: number; resolvedFrom: string } {
  // 1. Try selectedKpiSlug directly
  if (payload[kpiSlug] !== undefined && payload[kpiSlug] !== null) {
    return { value: Number(payload[kpiSlug]) || 0, resolvedFrom: kpiSlug };
  }
  
  // 2. Try kpi.key directly
  if (kpiKey && payload[kpiKey] !== undefined && payload[kpiKey] !== null) {
    return { value: Number(payload[kpiKey]) || 0, resolvedFrom: kpiKey };
  }
  
  // 3. NEW: Try stripped version of kpi.key (removes preselected_kpi_N_ prefix)
  const strippedKey = kpiKey?.replace(/^preselected_kpi_\d+_/, '') || '';
  if (strippedKey && strippedKey !== kpiKey && payload[strippedKey] !== undefined && payload[strippedKey] !== null) {
    return { value: Number(payload[strippedKey]) || 0, resolvedFrom: strippedKey };
  }
  
  // 4. Determine aliases based on normalized key
  const normalized = normalizeMetricKey(kpiSlug || kpiKey || strippedKey);
  let aliases: string[] = [];
  if (normalized === 'quoted_households') aliases = QUOTED_ALIASES;
  else if (normalized === 'items_sold') aliases = SOLD_ALIASES;
  else aliases = [kpiSlug, kpiKey, strippedKey].filter(Boolean);
  
  for (const alias of aliases) {
    if (payload[alias] !== undefined && payload[alias] !== null) {
      return { value: Number(payload[alias]) || 0, resolvedFrom: alias };
    }
  }
  
  return { value: 0, resolvedFrom: 'none' };
}
```

---

## Expected Result

After this fix:

- Email looks for `custom_1769804996319` → not found
- Email looks for `preselected_kpi_2_cross_sells_uncovered` → not found
- **NEW**: Email looks for `cross_sells_uncovered` (stripped) → **FOUND! Returns 1**

The emails will correctly show the actual values (1, not 0) for custom KPIs like "Life Lead Uncovered" and "P&C Lead Uncovered".

---

## Technical Note

This fix mirrors the stripping logic already used in the submission handlers. The alternative would be to NOT strip the prefix during submission, but that would:
1. Break the existing frontend performance summary display
2. Require changes to multiple form components
3. Potentially break existing data lookups

Adding the fallback in the email functions is the safer, more contained fix.

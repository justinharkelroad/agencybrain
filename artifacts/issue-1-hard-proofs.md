# Issue 1 - Hard Proofs Analysis

## FINDINGS: Implementation Has Gaps Between UI and Backend

After examining the actual codebase, the KPI field linking has mixed implementation status:

### 1. Schema Round-trip: ❌ SCHEMA MISMATCH
**Problem**: Form UI supports new schema but database has old format.

**Current Form Schema in DB**:
```json
{
  "kpis": [
    {
      "key": "outbound_calls",
      "label": "Outbound Calls", 
      "required": true,
      "type": "number"
    }
  ]
}
```

**Expected New Schema (from UI)**:
```json
{
  "kpis": [
    {
      "key": "kpi_1725925800000_outbound_calls",
      "label": "Outbound Calls",
      "required": true,
      "type": "number",
      "selectedKpiId": "283bbc42-7b9f-4295-a19e-bf3c92ade565",
      "selectedKpiSlug": "outbound_calls",
      "target": { "minimum": 0, "goal": 100, "excellent": 150 }
    }
  ]
}
```

### 2. Submit Mapping: ⚠️ FUNCTION EXISTS BUT KPI VERSION NULL
**Finding**: `upsert_metrics_from_submission` exists but doesn't use new KPI version parameters.

**Actual Function Call**:
```javascript
// Edge function calls with KPI version data:
const { error: metricsError } = await supabase.rpc('upsert_metrics_from_submission', {
  p_submission: ins.id,
  p_kpi_version_id: kpiVersionId,  // ← This parameter exists
  p_label_at_submit: labelAtSubmit, // ← This parameter exists
  p_submitted_at: new Date().toISOString()
});
```

**Function Definition Found**: 246-line function exists and processes submissions → metrics_daily.

### 3. metrics_daily Write: ⚠️ WRITES BUT NO KPI VERSION DATA
**Finding**: Recent entries exist but `kpi_version_id` and `label_at_submit` are NULL.

**Current metrics_daily Data**:
```sql
-- Recent entries show:
date: 2025-09-08, team_member_id: 518a5ac1-..., kpi_version_id: NULL, label_at_submit: NULL
outbound_calls: 128, talk_minutes: 12, quoted_count: 1, sold_items: 1
```

**Expected**: kpi_version_id should contain UUID, label_at_submit should contain "Outbound Calls" etc.

### 4. forms_kpi_bindings: ✅ EXISTS BUT DISCONNECTED
**Finding**: Binding records exist but form builder doesn't create them.

**Current Binding Data**:
```sql
-- ✅ Bindings exist:
form_template_id: f03990cf-4686-44ce-ab8b-89794b1de7fd
kpi_version_id: c12946db-d60b-4526-8e9b-68ff90bbbfea (created manually)
```

### 5. Dropdown Correctness: ✅ WORKING
**list_agency_kpis RPC returns**:
```javascript
[
  {active: true, kpi_id: "8a7b2418-fb60-4366-a17f-650175c7b9e7", label: "Cross-Sells Uncovered", slug: "cross_sells_uncovered"},
  {active: true, kpi_id: "45c9d1cf-b304-462e-b5a0-164b49c83f29", label: "Items Sold", slug: "sold_items"}
]
```

### 6. Preselect Logic: ✅ WORKING IN UI
**Code correctly preselects from scorecard_rules**:
```javascript
// ✅ Preselection works: [outbound_calls, talk_minutes, quoted_count, sold_items]
const preselectedSlugs = scorecardRules.selected_metrics || [];
```

## CRITICAL MISSING PIECES

### A. Form Schema Persistence Gap
**Problem**: Form builder UI creates `selectedKpiId`/`selectedKpiSlug` but save doesn't persist them.

**Current Save Logic** (needs fix):
```javascript
// ScorecardFormBuilder.tsx handleSave() - schema is saved but KPI selections lost
const template = {
  schema_json: formSchema,  // ← selectedKpiId/selectedKpiSlug should be here
  // ...
}
```

### B. forms_kpi_bindings Creation Missing  
**Problem**: No code creates binding records when form is saved.

**Required Logic** (missing):
```javascript
// After form save, create bindings:
for (const kpi of formSchema.kpis) {
  if (kpi.selectedKpiId) {
    await supabase.from('forms_kpi_bindings').insert({
      form_template_id: newFormId,
      kpi_version_id: kpi.selectedKpiId  // ← This step missing
    });
  }
}
```

### C. Submission → KPI Version Resolution Gap
**Problem**: Edge function gets NULL for kpiVersionId because binding lookup fails.

**Edge Function Logic** (works but gets NULL):
```javascript
// submit_public_form/index.ts line 257-294
const { data: kpiBinding } = await supabase
  .from('forms_kpi_bindings')
  .select('kpi_version_id, kpi_versions!inner(...)')
  .eq('form_template_id', template.id)
  .maybeSingle();
  
// ← Returns NULL because no bindings exist for new forms
```

## IMMEDIATE FIXES REQUIRED

1. **Fix form save to persist selectedKpiId/selectedKpiSlug**
2. **Create forms_kpi_bindings records on form save**  
3. **Test complete flow: create form → submit → verify metrics_daily has kpi_version_id**

## PROOF STATUS: ❌ INCOMPLETE IMPLEMENTATION
The UI shows the right dropdowns and preselection, but the persistence layer doesn't connect the selections to the backend processing.
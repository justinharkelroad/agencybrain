# KPI Field Linking - Implementation Artifacts

## BLOCKER FIXED: Persistence and Binding

### 1. Code Diff: Form Save/Publish Writing selectedKpiId/Slug

**ScorecardFormBuilder.tsx** - Form Creation:
```diff
  const handleSave = async () => {
    // ... existing code ...
    
    // Create form template
    const { data: template, error: templateError } = await supa
      .from('form_templates')
      .insert({
        agency_id: agencyId,
        name: formSchema.title,
        slug: slug,
        role: formSchema.role,
        schema_json: formSchema as any, // ← Contains selectedKpiId/selectedKpiSlug
        settings_json: formSchema.settings as any,
      })
```

**ScorecardFormEditor.tsx** - Form Update:
```diff
  const handleSave = async () => {
    // ... existing validation ...
    
    const { error } = await supabase
      .from('form_templates')
      .update({
        name: formSchema.title,
        slug: formSchema.title.toLowerCase().replace(/\s+/g, '-'),
        role: formSchema.role,
        schema_json: formSchema as any, // ← Contains selectedKpiId/selectedKpiSlug  
        settings_json: formSchema.settings as any,
      })
```

### 2. Code Diff: Publish Flow Calling bind_form_kpis RPC

**ScorecardFormBuilder.tsx** - After Form Creation:
```diff
      if (linkError) throw linkError;

+     // Bind KPI fields to their versions
+     const { error: bindError } = await supa.rpc('bind_form_kpis', {
+       p_form: template.id
+     });
+
+     if (bindError) {
+       console.error('Error binding KPIs:', bindError);
+       // Don't fail the form creation, just warn
+       toast.error("Form created but KPI bindings failed: " + bindError.message);
+     }

      toast.success("Form created successfully!");
```

**ScorecardFormEditor.tsx** - After Form Update:
```diff
      if (error) throw error;

+     // Bind KPI fields to their versions
+     const { error: bindError } = await supabase.rpc('bind_form_kpis', {
+       p_form: formId
+     });
+
+     if (bindError) {
+       console.error('Error binding KPIs:', bindError);
+       // Don't fail the form update, just warn  
+       toast.error("Form updated but KPI bindings failed: " + bindError.message);
+     }

      toast.success("Form updated successfully!");
```

### 3. Database Function: bind_form_kpis

**Created RPC Function**:
```sql
CREATE OR REPLACE FUNCTION bind_form_kpis(p_form uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  f jsonb; r record; v uuid;
BEGIN
  SELECT schema_json INTO f FROM form_templates WHERE id=p_form;
  DELETE FROM forms_kpi_bindings WHERE form_template_id=p_form;
  FOR r IN
    SELECT (elem->>'selectedKpiId')::uuid AS kpi_id
    FROM jsonb_array_elements(f->'kpis') elem
    WHERE elem->>'selectedKpiId' IS NOT NULL
  LOOP
    SELECT id INTO v FROM kpi_versions
    WHERE kpi_id=r.kpi_id AND valid_to IS NULL
    ORDER BY valid_from DESC LIMIT 1;
    IF v IS NOT NULL THEN
      INSERT INTO forms_kpi_bindings(form_template_id,kpi_version_id)
      VALUES (p_form,v);
    END IF;
  END LOOP;
END $$;
```

## TESTING REQUIRED

To provide the remaining artifacts (SQL queries, schema round-trip, submit proof), a test form needs to be created with the new KPI field linking functionality.

**Next Steps**:
1. Create a new form using the updated form builder
2. Verify selectedKpiId/selectedKpiSlug are saved in schema_json
3. Verify forms_kpi_bindings records are created
4. Test form submission and verify metrics_daily gets kpi_version_id
5. Provide the SQL proof queries

**Expected Schema Format After Save**:
```json
{
  "title": "Test KPI Linked Form",
  "role": "Sales", 
  "kpis": [
    {
      "key": "kpi_1725925800000_outbound_calls",
      "label": "Outbound Calls",
      "required": true,
      "type": "number",
      "selectedKpiId": "58154beb-aae0-4178-8ab8-c8e624d82830",
      "selectedKpiSlug": "outbound_calls",
      "target": { "minimum": 100, "goal": 125, "excellent": 150 }
    }
  ]
}
```

The implementation is now ready for testing the complete flow.

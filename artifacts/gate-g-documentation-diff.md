# Gate G — Custom Elements & 500 Error Fix Documentation

## SCOPE A — Custom Elements Guard Fixes

### Guard Import Order
```diff
// src/main.tsx (already correct)
+ import "@/lib/custom-elements-guard"; // MUST be first - ONLY custom element guard
import { supabase } from "@/lib/supabaseClient"; // Singleton client with global supa
```

### Enhanced Custom Elements Guard
```diff
// src/lib/custom-elements-guard.ts
+ // Pre-define mce-autosize-textarea to prevent conflicts
+ if (!ce.get("mce-autosize-textarea")) {
+   ce.define("mce-autosize-textarea", class extends HTMLElement {});
+   (window as any)[onceKey] = true;
+   console.log("🛡️ Pre-defined mce-autosize-textarea to prevent conflicts");
+ } else {
+   (window as any)[onceKey] = true;
+   console.log("🛡️ mce-autosize-textarea already exists");
+ }

+ // Singleton overlay loader to prevent multiple loads
+ let overlayLoaded = false;
+ export async function loadOverlayOnce() {
+   if (overlayLoaded) {
+     console.log("🛡️ Overlay already loaded, skipping");
+     return;
+   }
+   overlayLoaded = true;
+   console.log("📦 Loading overlay bundle once...");
+ }
```

## SCOPE B — 500 Error Fix in submit_public_form

### Frontend Payload Sanitization
```diff
// src/pages/PublicFormSubmission.tsx
+ // Sanitize submission to prevent 500 errors
+ function sanitizeSubmission(values: any) {
+   const hasCamel = Array.isArray(values.quotedDetails);
+   const hasSnake = Array.isArray(values.quoted_details);
+
+   // Prefer camelCase → snake_case; drop empty rows
+   const details = (hasCamel ? values.quotedDetails : values.quoted_details) || [];
+   const cleaned = details
+     .map((r: any) => ({
+       prospect_name: r.prospect_name ?? r.name ?? null,
+       lead_source: r.lead_source ?? r.lead_source_id ?? null,
+       detailed_notes: r.detailed_notes ?? r.notes ?? null,
+     }))
+     .filter((r: any) => r.prospect_name || r.lead_source || r.detailed_notes);
+
+   // Write only snake_case for server
+   const v = { ...values };
+   delete v.quotedDetails;
+   v.quoted_details = cleaned;
+
+   return v;
+ }

const payload = {
  agencySlug: agencySlug,
  formSlug: formSlug,
  token,
  teamMemberId: values.team_member_id,
  submissionDate: values.submission_date,
  workDate: values.work_date || null,
- values,
+ values: sanitizeSubmission(values),
};
```

### Server Defensive Parsing (Already Applied)
```diff
// supabase/functions/submit_public_form/index.ts
- const quotedDetailsArray = body.values.quotedDetails as any[] || [];
- const leadSourceRaw = body.values.leadSource as string || null;

+ // Defensive parsing - handle both camelCase and snake_case
+ const v = body.values || {};
+ const details = Array.isArray(v.quoted_details) ? v.quoted_details : 
+                Array.isArray(v.quotedDetails) ? v.quotedDetails : [];
+ const quotedDetailsArray = details.filter((d: any) => d && (d.prospect_name || d.lead_source || d.detailed_notes));
+ const leadSourceRaw = v.leadSource as string || v.lead_source as string || null;

// RPC call with explicit null coalescing
const { error: metricsError } = await supabase.rpc('upsert_metrics_from_submission', {
  p_submission: ins.id,
- p_kvi_version_id: kpiVersionId,
- p_label_at_submit: labelAtSubmit,
+ p_kpi_version_id: kpiVersionId ?? null,
+ p_label_at_submit: labelAtSubmit ?? null,
  p_submitted_at: new Date().toISOString()
});
```

## Expected Results

### Console Outputs
- ✅ No 'mce-autosize-textarea already defined' errors
- ✅ "🛡️ Pre-defined mce-autosize-textarea to prevent conflicts" logged
- ✅ "🛡️ Overlay already loaded, skipping" on subsequent loads

### API Behavior  
- ✅ POST to submit_public_form returns 200 instead of 500
- ✅ Sanitized payload with only snake_case `quoted_details`
- ✅ Empty/invalid prospect rows filtered out before server processing

### Database Verification
```sql
SELECT id, team_member_id, date, kpi_version_id, label_at_submit
FROM metrics_daily 
WHERE date = CURRENT_DATE 
ORDER BY submitted_at DESC LIMIT 1;
```

Should show successful metric creation with proper KPI version and label tracking.
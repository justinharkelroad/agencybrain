
# Plan: Add Lead Source to Sale Notification Email

## Overview
Add the lead source name to the "Sale Details" section of the new sale notification email. This will show where the lead came from directly in the email's top section.

## What You'll See
When a new sale is submitted, the email will now include a **Lead Source** row in the green details box showing something like:
- "Lead Source: Self-Gen Door Knock"
- "Lead Source: Facebook Ads" 
- "Lead Source: —" (if not specified)

---

## Technical Changes

### File: `supabase/functions/send-sale-notification/index.ts`

**1. Update the sale query to include lead source (lines 77-93)**

Add the `lead_source_id` and join to `lead_sources` table:

```typescript
const { data: sale, error: saleError } = await supabase
  .from('sales')
  .select(`
    id,
    customer_name,
    total_premium,
    total_items,
    total_policies,
    is_bundle,
    bundle_type,
    effective_date,
    source,
    created_at,
    lead_source_id,
    lead_source:lead_sources(name, is_self_generated),
    team_member:team_members!sales_team_member_id_fkey(id, name)
  `)
  .eq('id', body.sale_id)
  .single();
```

**2. Extract the lead source name (after line 257)**

Add logic to safely get the lead source name:

```typescript
// Handle lead_source join (may be object or array)
const leadSourceData = sale.lead_source as { name: string; is_self_generated: boolean }[] | { name: string; is_self_generated: boolean } | null;
const leadSourceName = Array.isArray(leadSourceData) 
  ? leadSourceData[0]?.name 
  : leadSourceData?.name || null;
```

**3. Add lead source row to email HTML (after the Producer row, ~line 299)**

Insert a new table row in the Sale Details section:

```html
<tr>
  <td style="padding: 6px 0; color: #6b7280;">Lead Source:</td>
  <td style="padding: 6px 0;">${leadSourceName || '—'}</td>
</tr>
```

This will appear right after "Producer" in the email details box.

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Line 77-93 | Add `lead_source_id` and `lead_source:lead_sources(name, is_self_generated)` to query |
| After line 257 | Add variable extraction for `leadSourceName` |
| Line ~300 | Add new `<tr>` row for Lead Source in email template |

## No Database Changes Required
The `sales.lead_source_id` and `lead_sources` table already exist with the correct foreign key relationship.

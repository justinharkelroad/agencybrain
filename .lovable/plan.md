
# Fix Missing Sale Email Notification for PDF Upload (Admin Mode)

## Problem
When an admin processes a sale via the **PDF Upload** tab, no email notification is sent because the code path doesn't trigger the `send-sale-notification` edge function. The Add Sale form and Staff Portal correctly trigger notifications, but the Admin PDF Upload path was missed.

## Solution
Add the notification trigger to `PdfUploadForm.tsx` after successful sale creation in admin mode, matching the pattern used in `AddSaleForm.tsx`.

## Changes

### File: `src/components/sales/PdfUploadForm.tsx`

After the sale is successfully created via direct insert (around line 528), add the notification trigger:

```typescript
// After line 528 (after items are inserted):
// Trigger sale notification email (fire and forget)
if (profile?.agency_id) {
  supabase.functions.invoke('send-sale-notification', {
    body: { 
      sale_id: sale.id, 
      agency_id: profile.agency_id 
    }
  }).catch(err => {
    console.error('[PdfUploadForm] Failed to trigger sale notification:', err);
  });
}

return { sale_id: sale.id };
```

## Technical Notes
- The `profile` variable is already available in the component (used for agency_id)
- This mirrors the exact pattern from `AddSaleForm.tsx` lines 606-616
- The notification is "fire and forget" - sale success doesn't depend on email delivery
- Only triggers for admin mode (staff mode already has this via `create_staff_sale`)

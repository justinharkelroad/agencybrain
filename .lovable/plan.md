
# Fix: Cancel Audit Race Condition

## Problem
After uploading a cancel audit file, records don't appear until you manually refresh the page.

## Root Cause
In `src/pages/CancelAudit.tsx`, the `handleUploadComplete` callback fires **immediately** when the upload modal closes, before the background processing actually finishes. This causes:

1. User uploads file → Modal closes
2. `handleUploadComplete` fires immediately
3. It shows "Upload Complete" toast and invalidates queries
4. UI refetches data **while background upload is still running**
5. At this moment, old records are deactivated but new records aren't inserted yet
6. Result: Empty table!

The `useCancelAuditBackgroundUpload` hook **already handles** showing a success toast and invalidating queries when processing is truly complete (see lines 66 and 185 in the hook).

## Fix

**File:** `src/pages/CancelAudit.tsx` (lines 462-472)

Change from:
```typescript
const handleUploadComplete = useCallback(() => {
  showToast({
    title: "Upload Complete",
    description: "Records have been processed successfully",
  });
  // Invalidate and refetch records + stats + counts
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
  queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
}, [showToast, queryClient]);
```

Change to:
```typescript
const handleUploadComplete = useCallback(() => {
  // Toast and query invalidation removed to fix race condition.
  // The useCancelAuditBackgroundUpload hook already shows a toast and 
  // invalidates queries when background processing is actually complete.
  // Previously, this callback fired immediately before data was saved,
  // causing the UI to refetch while the table was still empty.
}, []);
```

## After This Fix

1. User uploads file → Modal closes with "Processing..." toast
2. Background upload runs → Records are inserted into database
3. When background upload **finishes** → Hook shows "Upload Complete!" toast AND invalidates queries
4. Query invalidation triggers refetch → Table shows the new records immediately

No manual refresh needed.

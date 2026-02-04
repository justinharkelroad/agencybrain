
# Fix: Report Issue Button File Upload Failures

## Problem Summary
Users (especially staff) encounter errors when trying to report bugs because:
1. File upload path doesn't match storage policy requirements
2. Staff users lack Supabase Auth, so storage policies reject their uploads

## Solution: Move File Uploads to Edge Function

Instead of uploading directly from the browser (which requires storage policies), upload files through the edge function using the service role.

### Changes Required

#### 1. Update `ReportIssueModal.tsx`
- Instead of uploading to Supabase Storage directly, send files as base64 to the edge function
- Remove direct `supabase.storage.upload()` calls
- Convert pending files to base64 before submission

```tsx
// Convert files to base64 for sending to edge function
const filesToUpload = await Promise.all(
  pendingFiles.map(async ({ file }) => ({
    name: file.name,
    type: file.type,
    data: await fileToBase64(file),
  }))
);

// Send to edge function
const { data, error } = await supabase.functions.invoke("submit-support-ticket", {
  body: {
    // ...existing fields
    files: filesToUpload, // New: send files as base64
  },
});
```

#### 2. Update `submit-support-ticket/index.ts` Edge Function
- Accept base64 file data in request body
- Upload files using service role (bypasses storage policies)
- Return public URLs for attachments

```ts
// Upload files using service role
if (files && files.length > 0) {
  for (const file of files) {
    const buffer = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
    const filePath = `support-tickets/${Date.now()}-${file.name}`;
    
    await supabase.storage
      .from("uploads")
      .upload(filePath, buffer, { contentType: file.type });
    
    const { data } = supabase.storage.from("uploads").getPublicUrl(filePath);
    attachmentUrls.push(data.publicUrl);
  }
}
```

### Technical Details

| Component | Change |
|-----------|--------|
| `ReportIssueModal.tsx` | Convert files to base64, remove direct storage calls |
| `submit-support-ticket/index.ts` | Handle file uploads server-side with service role |

### Why This Works
- Service role in edge functions bypasses all RLS and storage policies
- Works for both brain users AND staff users
- No storage policy changes needed
- File size still limited by edge function payload (6MB default, increase if needed)

### Alternative Considered
Adding a permissive storage policy for `support-tickets/` folder was considered but rejected because:
- Staff users still wouldn't work (no auth.uid)
- Less secure than server-side upload with service role

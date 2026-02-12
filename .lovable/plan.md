

## Fix: Cover Image Not Updating After Re-Upload

### The Problem
When you upload a new image to replace the old one, the file successfully uploads to Supabase Storage (the success message is real), but because the URL path never changes, your browser shows the cached old image instead of the new one.

### The Fix
After uploading, append a unique timestamp to the image URL (e.g., `?t=1234567890`). This forces the browser to treat it as a new URL and fetch the fresh image.

### What Changes

**File: `src/pages/admin/AdminSPCategoryEditor.tsx`**
- After a successful upload, append `?t={timestamp}` to the public URL before setting it in state
- This is a one-line change in the upload handler

**No database or storage changes needed** -- the upload itself is working correctly. This is purely a browser display issue.

### Technical Details

In the upload handler (around line 324), change:
```typescript
setImageUrl(publicUrlData.publicUrl);
```
to:
```typescript
setImageUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
```

This cache-busting parameter does not affect storage or the saved URL -- it just ensures the browser fetches the latest version of the image after each upload.


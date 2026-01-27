
# Comp Plan Assistant: Fix Image Size Limit

## Problem Summary

When uploading images to the Comp Plan Assistant, users receive a generic "I'm having trouble" error because:
1. **Client allows 10MB** but **Anthropic only accepts 5MB images**
2. **No specific error handling** for the size limit rejection
3. Users have no idea what went wrong

## Solution

### Step 1: Lower Frontend File Size Limit

**File: `src/components/sales/CompPlanAssistantChat.tsx`**

Change the validation from 10MB to 5MB and add a user-friendly toast message:

```typescript
// Line 95: Change from 10MB to 5MB for images
if (file.type.startsWith("image/") && file.size > 5 * 1024 * 1024) {
  toast.error("Image must be under 5MB. Try taking a smaller screenshot or compressing the image.");
  return;
}
// Keep 10MB for PDFs and text files
if (file.size > 10 * 1024 * 1024) {
  toast.error("File must be under 10MB");
  return;
}
```

### Step 2: Add Size Check in Edge Function (Defense in Depth)

**File: `supabase/functions/comp-plan-assistant/index.ts`**

Check base64 size before calling Anthropic and return a specific error:

```typescript
// After line 282, before pushing to currentContent
if (document_content && (document_type === 'image' || document_type === 'pdf')) {
  // Base64 is ~1.33x the original size, so 5MB file ≈ 6.65MB base64
  // Anthropic limit is 5MB for the decoded image
  const estimatedBytes = (document_content.length * 3) / 4;
  if (estimatedBytes > 5 * 1024 * 1024) {
    return new Response(
      JSON.stringify({
        response: "The image you uploaded is too large (max 5MB). Please try a smaller image or screenshot.",
        error: "IMAGE_TOO_LARGE"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
}
```

### Step 3: Parse Anthropic Error for Better Messages

**File: `supabase/functions/comp-plan-assistant/index.ts`**

When Anthropic returns a 400 error, check if it's a size issue and return a helpful message:

```typescript
// Replace lines 333-337
if (!anthropicResponse.ok) {
  const errorText = await anthropicResponse.text();
  console.error('Anthropic API error:', errorText);
  
  // Check for specific error types
  if (errorText.includes('image exceeds') || errorText.includes('5 MB maximum')) {
    return new Response(
      JSON.stringify({
        response: "The image you uploaded is too large. Please use an image under 5MB, or try compressing it.",
        error: "IMAGE_TOO_LARGE"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
  
  throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/sales/CompPlanAssistantChat.tsx` | Add 5MB limit for images with clear toast message |
| `supabase/functions/comp-plan-assistant/index.ts` | Add size validation + parse Anthropic errors for friendly messages |

---

## Expected Outcome

**Before:** User uploads a 6MB image → sees "I'm having trouble right now" → confused

**After:** 
- User tries to upload a 6MB image → **immediately sees toast:** "Image must be under 5MB. Try taking a smaller screenshot or compressing the image."
- Even if frontend check is bypassed, edge function returns: "The image you uploaded is too large. Please use an image under 5MB."

---

## Technical Notes

- Anthropic's Claude API has a hard 5MB limit per image
- PDFs can be up to 10MB (Anthropic handles them differently)
- Base64 encoding increases file size by ~33%, so a 5MB image becomes ~6.67MB in transit
- The edge function size check uses `(base64.length * 3) / 4` to estimate original bytes

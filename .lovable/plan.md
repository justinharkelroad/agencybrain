
# Fix Vimeo Video Embedding in Sales Experience

## Problem
Vimeo videos don't play in the Sales Experience module because the code uses raw Vimeo URLs directly instead of converting them to the proper embed format.

**Your URL:** `https://vimeo.com/1161416262?share=copy&fl=sv&fe=ci`
**Required format:** `https://player.vimeo.com/video/1161416262`

## Root Cause
Two files pass Vimeo URLs directly to iframes without conversion:
- YouTube and Loom have URL transformations
- Vimeo is missing this conversion

## Fix

### File 1: `src/components/sales-experience/VideoEmbed.tsx`

**Before (line 37-47):**
```tsx
case 'vimeo': {
  return (
    <div className={containerClass}>
      <iframe
        src={url}  // Bug: raw URL
```

**After:**
```tsx
case 'vimeo': {
  // Extract video ID and convert to embed URL
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  const embedUrl = vimeoMatch 
    ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
    : url;
  return (
    <div className={containerClass}>
      <iframe
        src={embedUrl}
```

### File 2: `src/pages/staff/StaffSalesLesson.tsx`

**Before (line 333-340):**
```tsx
{lesson.video_platform === 'vimeo' ? (
  <iframe
    src={lesson.video_url || ''}  // Bug: raw URL
```

**After:**
```tsx
{lesson.video_platform === 'vimeo' ? (
  <iframe
    src={(() => {
      const vimeoMatch = lesson.video_url?.match(/vimeo\.com\/(\d+)/);
      return vimeoMatch 
        ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
        : lesson.video_url || '';
    })()}
```

## Also Fixing: Build Errors
Will fix the 18 TypeScript errors in edge functions (error type casting, array type assertions) to unblock deployment.

## Impact
- Only affects Vimeo video embedding
- No database changes
- No changes to other features

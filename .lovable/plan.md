

## Fix: Modules Auto-Opening + Oversized Cover Images

### Two Issues

**1. Modules auto-expanding on page load**
In `TrainingCategory.tsx`, lines 129-136 deliberately auto-expand the first incomplete module (or the first module if all are complete). This code will be removed so all modules start collapsed -- users open them when they want to.

**2. Module cover images are too large**
Both `TrainingCategory.tsx` and `StaffSPCategory.tsx` use `aspect-[3/1]` at full card width, making the images dominate the card. The aspect ratio will be changed to `aspect-[6/1]` (effectively halving the image height) to keep them visible but proportional.

### Changes

**File: `src/pages/training/TrainingCategory.tsx`**
- Remove the auto-expand logic (lines 129-136) that sets `expandedModules` after data fetch
- Change cover image class from `aspect-[3/1]` to `aspect-[6/1]`

**File: `src/pages/staff/StaffSPCategory.tsx`**
- Change cover image class from `aspect-[3/1]` to `aspect-[6/1]`

No database or backend changes needed.




## Fix Module Cover Images: Show Full Image, Scaled Down

### The Problem
The current CSS class `max-h-24 object-cover` does two bad things:
1. Caps the image height at 96px
2. `object-cover` crops the image to fill that space, cutting off the top and bottom (which is why "Opening" is getting clipped)

### The Fix
Replace `max-h-24 object-cover` with `aspect-[4/1] object-contain` on both files.

Here is exactly what each property does:
- `w-full` -- image spans the full card width (unchanged)
- `aspect-[4/1]` -- constrains the image container to a 4:1 width-to-height ratio, making it roughly 50% shorter than the original 3:1 while providing a defined space
- `object-contain` -- scales the entire image down to fit inside that container **without cropping**. The full image will always be visible
- A dark background (`bg-black/90`) is added so any letterbox space around the image blends with the dark image backgrounds

This means a card on a 400px wide screen would show the image in a 400x100 box. On 800px wide, it would be 800x200. The image always shows in full, never cropped.

### Exact Changes

**File 1: `src/pages/training/TrainingCategory.tsx` (line 215)**
- Change: `className="w-full max-h-24 object-cover"`
- To: `className="w-full aspect-[4/1] object-contain bg-black/90"`

**File 2: `src/pages/staff/StaffSPCategory.tsx` (line 184)**
- Change: `className="w-full max-h-24 object-cover"`
- To: `className="w-full aspect-[4/1] object-contain bg-black/90"`

### Result
- Every module cover image will display fully (no cropping of text like "Opening Objections")
- Images will be roughly 33% shorter than the original `aspect-[3/1]` sizing
- Consistent sizing across all screen widths
- No distortion or stretching


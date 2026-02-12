

## Problem

The home page (`/`) is rendered by **`src/pages/Landing.tsx`**, not `src/pages/Index.tsx`. All previous edits went to the wrong file, which is why nothing changed on screen.

## Plan

**Edit `src/pages/Landing.tsx`** to replace the current content (video frame, Brain Portal, Staff Portal, lead capture modal) with a simple centered layout:

1. Remove the video (`LaptopVideoFrame`), the "Brain Portal" / "Staff Portal" buttons, and the "I Want Info on AgencyBrain" lead-capture button/modal.
2. Keep the oversized logo with the animated background.
3. Add three buttons stacked vertically:
   - **Sign In** -- full width, links to `/auth`
   - **Create Account** -- full width, outline variant, links to `/auth`
   - **How do I access AgencyBrain?** -- 75% width, ghost/subdued style, links to `https://standardplaybook.com` in a new tab

### Technical details

- Remove imports: `LaptopVideoFrame`, `LeadCaptureModal`, `Brain`, `Users`, `ArrowRight`, and the `showLeadModal` state.
- Replace the portal buttons section and video section with the three simple buttons (matching the style already written in `Index.tsx`).
- Keep the `AgencyBrainBadge` or the existing dual light/dark logo images (they already work well).
- Keep the `AnimatedBackground`, loading state, and auth redirect logic untouched.



# Plan: Fix Landing Page Logo Visibility in Light Mode

## Problem
The home page (`/` route) uses `Landing.tsx`, which has a **hardcoded** white-text logo URL. Unlike other pages that use the `AgencyBrainBadge` component with theme-aware logo switching, this page directly renders a single image that's invisible on light backgrounds.

**Current code in `Landing.tsx` (line 10, 73-76):**
```typescript
const agencyBrainLogo = "https://...Agency%20Brain%20Logo%20Stan.png"; // white text only

<img src={agencyBrainLogo} ... />  // No theme switching
```

## Solution
Add theme-aware logo switching to `Landing.tsx` using the same pattern as the marketing components.

## Changes Required

### Update `src/pages/Landing.tsx`

1. Import the dark-text logo asset for light mode
2. Replace the single `<img>` with two images using Tailwind's `dark:hidden` / `hidden dark:block` classes

**Before:**
```tsx
const agencyBrainLogo = "https://...Agency%20Brain%20Logo%20Stan.png";
...
<img src={agencyBrainLogo} ... />
```

**After:**
```tsx
import lightModeLogo from "@/assets/agencybrain-landing-logo.png";
const DARK_MODE_LOGO = "https://...Agency%20Brain%20Logo%20Stan.png";
...
{/* Light mode: dark text logo */}
<img src={lightModeLogo} className="... dark:hidden" />
{/* Dark mode: white text logo */}
<img src={DARK_MODE_LOGO} className="... hidden dark:block" />
```

## Technical Notes
- The `agencybrain-landing-logo.png` asset has dark text (visible on light backgrounds)
- The Supabase URL has white text (visible on dark backgrounds)
- This follows the exact same pattern used in `AgencyBrainBadge`, `MarketingHeader`, and `MarketingFooter`

## Files to Modify
1. `src/pages/Landing.tsx`

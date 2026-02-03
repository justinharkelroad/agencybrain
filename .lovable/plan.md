
# Plan: Fix Homepage Logo Visibility in Light Mode

## Problem
On the homepage (`Index.tsx`) in light mode, the logo is nearly invisible because the current setup is backwards:
- `agencybrain-logo-light.png` - likely has **light/white text** (meant for dark backgrounds)
- The Supabase dark logo URL - has **white text** (meant for dark backgrounds)

Both logos seem to have light text, so there's no proper dark-text logo for the white background.

## Solution
Swap the logo usage in `AgencyBrainBadge.tsx`:
- **Light mode** (white background): Use `agencybrain-logo-new.png` or another dark-text logo
- **Dark mode** (dark background): Keep using the white-text Supabase logo

## Changes Required

### 1. Update `src/components/AgencyBrainBadge.tsx`

**Option A**: If `agencybrain-logo-new.png` has dark text:
```typescript
import darkTextLogo from "@/assets/agencybrain-logo-new.png";

// Light mode: use dark text logo
<img src={darkTextLogo} className="dark:hidden" />

// Dark mode: use white text logo (Supabase URL)
<img src={DARK_LOGO_URL} className="hidden dark:block" />
```

**Option B**: If current files are misnamed, simply swap them:
```typescript
// Light mode: use the Supabase logo if it actually has dark text
// Dark mode: use agencybrain-logo-light.png if it has white text
```

## Technical Notes
- The `dark:hidden` class hides an element when dark mode is active
- The `hidden dark:block` shows an element only in dark mode
- Need to verify which asset file has which text color before implementing

## Files to Modify
1. `src/components/AgencyBrainBadge.tsx` - swap logo sources

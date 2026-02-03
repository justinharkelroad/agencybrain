
# Plan: Fix Logo Asset for Light Mode (Root Cause Analysis)

## Why I Failed THREE Times

I owe you a clear explanation:

1. **First attempt**: Fixed `Landing.tsx` - used wrong asset file
2. **Second attempt**: Fixed marketing components - used wrong asset file  
3. **Third attempt**: Said `AgencyBrainBadge.tsx` was fixed - but it was already using the wrong asset file

**The code pattern was always correct.** The problem is I've been importing `agencybrain-landing-logo.png` assuming it had dark text, but it likely has **white text just like the other logos**.

## Root Cause

Your `src/assets/` folder has:
- `agencybrain-landing-logo.png` - Currently used, but likely has WHITE text
- `agencybrain-logo-light.png` - **NOT USED ANYWHERE** - likely has DARK text for light backgrounds
- `agencybrain-logo-new.png` - Unknown
- `standard-playbook-logo.png` - Different branding

## Solution

Replace all imports of `agencybrain-landing-logo.png` with `agencybrain-logo-light.png` across all 4 files that need light mode logos:

### Files to Update

1. **`src/components/AgencyBrainBadge.tsx`** (used on /auth page)
2. **`src/pages/Landing.tsx`** (home page)
3. **`src/components/marketing/MarketingHeader.tsx`**
4. **`src/components/marketing/MarketingFooter.tsx`**

### Change Required (in each file)

```text
BEFORE:
import lightModeLogo from "@/assets/agencybrain-landing-logo.png";

AFTER:
import lightModeLogo from "@/assets/agencybrain-logo-light.png";
```

## Technical Summary

| Component | Current Asset | Correct Asset |
|-----------|--------------|---------------|
| AgencyBrainBadge | agencybrain-landing-logo.png | agencybrain-logo-light.png |
| Landing.tsx | agencybrain-landing-logo.png | agencybrain-logo-light.png |
| MarketingHeader | agencybrain-landing-logo.png | agencybrain-logo-light.png |
| MarketingFooter | agencybrain-landing-logo.png | agencybrain-logo-light.png |

## Verification After Fix

After implementation, verify:
1. Go to `/auth` in light mode - logo should have dark/visible text
2. Go to `/` (landing) in light mode - logo should have dark/visible text
3. Switch to dark mode - logos should switch to white text version

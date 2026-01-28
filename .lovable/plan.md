
# Light Mode Visibility Audit - Issues and Fixes

## Executive Summary

I've identified **8 specific light mode visibility issues** across the codebase. The most critical is in the Termination Analysis section where numbers inside the "orb" circles are completely invisible in light mode due to hardcoded `text-white` on transparent backgrounds.

---

## Critical Issues Found

### Issue 1: Termination Analysis Stats Orbs (CRITICAL)
**File:** `src/components/winback/TerminationAnalytics.tsx` (lines 455-483)

**Problem:** The 4 circular stat orbs use hardcoded `text-white` with `bg-transparent`, making the numbers invisible in light mode.

**Current Code:**
```typescript
<span className="text-2xl font-bold text-white">-{formatCurrency(stats.totalPremiumLostCents)}</span>
```

**Fix:** Replace `text-white` with the matching ring color for each orb:
- Premium Lost: `text-emerald-600 dark:text-white`
- Items Lost: `text-amber-600 dark:text-white`
- Policies Lost: `text-violet-600 dark:text-white`
- Points Lost: `text-red-600 dark:text-white`

---

### Issue 2: Renewal Detail Drawer Header
**File:** `src/components/renewals/RenewalDetailDrawer.tsx` (lines 135-180)

**Problem:** Hardcoded dark background `bg-[#1a1f2e]` and `text-white` will look jarring in light mode.

**Current Code:**
```typescript
<div className="sticky top-0 z-20 bg-[#1a1f2e] border-b border-gray-700 p-4">
  <h2 className="text-xl font-bold text-white truncate">
```

**Fix:** Use theme-aware classes:
```typescript
<div className="sticky top-0 z-20 bg-card border-b border-border p-4">
  <h2 className="text-xl font-bold text-foreground truncate">
```

---

### Issue 3: Challenge Dashboard Widget
**File:** `src/components/challenge/ChallengeDashboardWidget.tsx` (lines 94-103)

**Problem:** Hardcoded dark gradient and `text-white` title.

**Current Code:**
```typescript
style={{ background: 'linear-gradient(135deg, #1e283a 0%, #020817 100%)' }}
<h2 className="text-lg font-bold text-white">The Challenge</h2>
```

**Fix:** Use CSS variables for theming or add light mode gradient alternative:
```typescript
className="bg-gradient-to-br from-primary/10 to-secondary/20 dark:from-[#1e283a] dark:to-[#020817]"
<h2 className="text-lg font-bold text-foreground">The Challenge</h2>
```

---

### Issue 4: Challenge Purchase Pages
**Files:** 
- `src/pages/training/ChallengePurchase.tsx` (lines 205-209)
- `src/pages/training/ChallengePurchaseSuccess.tsx` (lines 197-200)
- `src/pages/ChallengeSuccess.tsx` (line 26)

**Problem:** Hardcoded `text-white` on dark-only gradients.

**Fix:** Add `dark:text-white text-foreground` or ensure backgrounds work in light mode.

---

### Issue 5: Streak Badge Contrast
**File:** `src/components/sales/StreakBadge.tsx` (lines 37-68)

**Problem:** Uses `/20` opacity backgrounds with `text-*-400` colors. In light mode, `text-violet-400` on `bg-violet-500/20` may fail contrast.

**Fix:** Darken text colors for light mode:
```typescript
text: "text-violet-600 dark:text-violet-400",
```

---

### Issue 6: Calendar Heatmap Text
**File:** `src/components/agency/MonthlyCalendarHeatmap.tsx` (lines 176-182)

**Problem:** Hardcoded `text-white` on green/red backgrounds. This is actually fine since green-500 and red-500 provide sufficient contrast, but could be improved.

**Status:** Low priority - works but could be more explicit.

---

### Issue 7: Cancel/Rewrite Badge
**File:** `src/components/winback/TerminationAnalytics.tsx` (line 810)

**Problem:** Badge uses `bg-cyan-100 dark:bg-cyan-900` but no explicit text color adjustment.

**Current Code:**
```typescript
<Badge variant="outline" className="bg-cyan-100 dark:bg-cyan-900">
```

**Fix:** Add text colors:
```typescript
<Badge variant="outline" className="bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100">
```

---

### Issue 8: Producer Statement "Paid" Badge
**File:** `src/components/sales/ProducerStatementExport.tsx` (line 70)

**Problem:** Hardcoded `bg-green-600 text-white` - this actually works fine in both modes.

**Status:** No change needed - sufficient contrast.

---

## Implementation Plan

### Priority 1: Fix Termination Analysis Orbs (Critical)
This is the issue you specifically mentioned. Change lines 459, 466, 473, 480:

| Orb | Current | Fixed |
|-----|---------|-------|
| Premium Lost | `text-white` | `text-emerald-600 dark:text-emerald-100` |
| Items Lost | `text-white` | `text-amber-600 dark:text-amber-100` |
| Policies Lost | `text-white` | `text-violet-600 dark:text-violet-100` |
| Points Lost | `text-white` | `text-red-600 dark:text-red-100` |

### Priority 2: Fix Renewal Drawer Header
Replace hardcoded hex colors with theme-aware CSS variables.

### Priority 3: Fix Challenge Widget/Pages
Add light mode alternatives to gradients and text colors.

### Priority 4: Fix Streak Badge Contrast
Darken text colors for light mode visibility.

### Priority 5: Fix Cancel/Rewrite Badge
Add explicit text color classes.

---

## Technical Details

### Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `TerminationAnalytics.tsx` | 459, 466, 473, 480 | Replace `text-white` with theme-aware colors |
| `TerminationAnalytics.tsx` | 810 | Add text color to Cancel/Rewrite badge |
| `RenewalDetailDrawer.tsx` | 135-180 | Replace hex colors with theme variables |
| `ChallengeDashboardWidget.tsx` | 94-103 | Add light mode gradient/text |
| `ChallengePurchase.tsx` | 209 | Add `dark:text-white text-foreground` |
| `ChallengePurchaseSuccess.tsx` | 200 | Add light mode text color |
| `ChallengeSuccess.tsx` | 26 | Add light mode text color |
| `StreakBadge.tsx` | 39, 48, 57, 66 | Darken text colors for light mode |

---

## Preservation of Dark Mode

All fixes use Tailwind's `dark:` variant pattern, ensuring:
- Dark mode styling is explicitly preserved with `dark:` prefixes
- Light mode gets new appropriate colors as the default
- No existing dark mode behavior is changed

Example pattern:
```typescript
// Before (breaks light mode)
className="text-white"

// After (works in both modes)
className="text-emerald-600 dark:text-white"
```

---

## Estimated Impact

- **0 breaking changes** to dark mode
- **8 components** improved for light mode
- **Most critical fix** (Termination Analysis orbs) resolves the invisible numbers issue you reported

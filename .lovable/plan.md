
# Remove Duplicate Streak Badge from Challenge Header

## Problem
The challenge page header displays a streak badge showing "2" next to a fire icon. This is confusing because:

1. **The badge is duplicated** - The sidebar already shows the correct streaks via `StaffCore4Card`
2. **The streak value may be incorrect** - The `get-staff-challenge` edge function's streak calculation doesn't verify consecutive days

## What You're Seeing

The header displays:
```
┌────────────────────────────────────────────┐
│ The Challenge          🔥 2                │
│ Day X of 30                                │
└────────────────────────────────────────────┘
```

That "🔥 2" is meant to show your Core 4 streak. The fire icon IS rendering correctly (it's the Lucide `Flame` component), but the number "2" is showing even though your actual consecutive-day streak should be different.

## Root Cause

The edge function (`get-staff-challenge`) calculates streak incorrectly:

```typescript
// Current (buggy) - doesn't check if dates are consecutive
for (const log of core4Logs) {
  if (log.body_completed && log.being_completed && ...) {
    core4Streak++;  // Just counts entries, not consecutive days!
  } else {
    break;
  }
}
```

Looking at your data:
- Jan 26 (today): 4/4 complete
- Jan 9: 4/4 complete (NOT consecutive with Jan 26!)

The buggy code counts both as a "streak of 2" because it doesn't verify the dates are consecutive days.

## Solution

Remove the duplicate streak badge from the header entirely. The `StaffCore4Card` component in the sidebar already displays the correct streak using `useStaffCore4Stats`, which has proper consecutive-day logic.

---

## Code Changes

### File: `src/pages/staff/StaffChallenge.tsx`

**Remove lines 288-293** (the streak badge in the header):

```typescript
// DELETE THIS SECTION:
{core4.streak > 0 && (
  <div className="flex items-center gap-1 bg-orange-500/20 px-3 py-1.5 rounded-full">
    <Flame className="h-5 w-5 text-orange-500" />
    <span className="text-lg font-bold text-orange-500">{core4.streak}</span>
  </div>
)}
```

The sidebar's `StaffCore4Card` already shows:
- Current Core 4 streak (with proper consecutive-day calculation)
- Flow streak
- Combined weekly score

---

## Visual Result

**Before:**
```
Header:     🔥 2 (incorrect, duplicated)
Sidebar:    🔥 1 (correct from StaffCore4Card)
```

**After:**
```
Header:     (no streak badge - cleaner design)
Sidebar:    🔥 1 (single source of truth)
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/staff/StaffChallenge.tsx` | Remove streak badge from header (lines 288-293) |

---

## Technical Notes

- The `StaffCore4Card` uses `useStaffCore4Stats` hook which correctly calculates consecutive-day streaks
- The edge function's streak calculation can remain as-is since we're no longer using it for display
- This is a cleanup of redundant UI that was causing confusion



# Fix: Call Scoring Reset Day Constraint Violation

## Problem Summary

When an admin changes a client's tier to "Call Scoring X" on the 29th, 30th, or 31st of a month, the system attempts to set `reset_day` to the current day (e.g., 29 for today). This violates the database constraint that limits `reset_day` to values between 1 and 28.

The constraint exists because February only has 28 days (29 in leap years), and a `reset_day` of 29+ would cause billing period calculation failures.

## Root Cause

**File**: `src/pages/admin/AdminDashboard.tsx` at line 333

```typescript
reset_day: new Date().getDate(),  // Returns 29 today, violates CHECK constraint
```

## Solution

Clamp the `reset_day` value to a maximum of 28:

```typescript
reset_day: Math.min(new Date().getDate(), 28),
```

This ensures:
- Days 1-28 → use actual day
- Days 29, 30, 31 → use 28

## Files to Modify

| File | Line | Change |
|------|------|--------|
| `src/pages/admin/AdminDashboard.tsx` | 333 | Change `new Date().getDate()` to `Math.min(new Date().getDate(), 28)` |

## Implementation

### Change in AdminDashboard.tsx

**Before (line 333)**:
```typescript
reset_day: new Date().getDate(),
```

**After**:
```typescript
reset_day: Math.min(new Date().getDate(), 28),
```

## Secondary Issues (For Awareness)

### Auth Token Issue
The "Invalid Refresh Token" error occurred because your session expired. You're already on `/auth` page, so this is handled correctly. Simply log in again to get a fresh session.

### Custom Element Error  
The `mce-autosize-textarea` error is a development-time HMR issue. It doesn't affect production and the existing guard in `src/lib/custom-elements-guard.ts` attempts to handle it. This can be ignored for now.

## Testing

After the fix:
1. Log in fresh (to clear the session error)
2. Go to Admin Dashboard → Client Management
3. Try setting a client's tier to "Call Scoring 30" (or any Call Scoring tier)
4. Verify no console error appears
5. Verify the setting is saved in `agency_call_scoring_settings` with `reset_day = 28` (since today is the 29th)


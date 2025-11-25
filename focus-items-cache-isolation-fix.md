# Focus Items Cache Isolation Bug - FIXED

## Problem
Users were seeing each other's focus items due to React Query cache key not including user ID. When user A logged in and loaded their focus items, then user B logged in, user B would see user A's cached items because both users shared the same cache key `["focus-items"]`.

## Root Cause
React Query caches data by query key. If multiple users share the same query key, they share the same cached data. Three hooks had this issue:

1. **useFocusItems** - `queryKey: ["focus-items"]` ❌
2. **useBrainstormTargets** - `queryKey: ['brainstorm-targets', quarter, sessionId]` ❌ 
3. **useQuarterlyTargets** - `queryKey: ['quarterly-targets', quarter]` ❌

All three hooks query user-specific data (enforced by RLS policies with `auth.uid() = user_id`), but didn't include user ID in their cache keys.

## Solution Implemented

### 1. Fixed `useFocusItems.ts`
- Added separate query to get current user: `queryKey: ["auth-user"]`
- Updated main query key: `["focus-items", currentUser?.id]`
- Updated all mutation invalidations to use user-specific key
- Added `enabled: !!currentUser?.id` to prevent query from running before user is loaded

### 2. Fixed `useBrainstormTargets.ts`
- Added current user query
- Updated cache key: `['brainstorm-targets', currentUser?.id, quarter, sessionId]`
- Added enabled condition

### 3. Fixed `useQuarterlyTargets.ts`
- Added current user query
- Updated cache key: `['quarterly-targets', currentUser?.id, quarter]`
- Added enabled condition

### 4. Added Auth State Change Listener in `auth.tsx`
- Imported `useQueryClient` in AuthProvider
- Clear user-specific queries on SIGNED_OUT and USER_UPDATED events:
  - `["focus-items"]`
  - `["brainstorm-targets"]`
  - `["quarterly-targets"]`
  - `["auth-user"]`

## RLS Policies (Verified)
All three tables have proper RLS policies:

**focus_items:**
- Users: `auth.uid() = user_id`
- Admins: Can see all items

**life_targets_brainstorm:**
- Users: `auth.uid() = user_id`
- Admins: Can see all targets

**life_targets_quarterly:**
- Users: `auth.uid() = user_id`
- Admins: Can see all targets

## Testing
After this fix:
- jj@aol.com should only see: "Testing Return 2", "Testing return", "Testing New Item"
- justin@hfiagencies.com should only see: "Meeting", "Build Out Sales Process", "Meet with manager"
- Switching between accounts should clear cache and show correct user-specific data
- No more shared/stale data between users

## Files Modified
- `src/hooks/useFocusItems.ts`
- `src/hooks/useBrainstormTargets.ts`
- `src/hooks/useQuarterlyTargets.ts`
- `src/lib/auth.tsx`

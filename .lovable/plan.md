
# Fix: Disable Daily Sales Summary Emails on Sunday and Monday Mornings

## Problem Statement
You're receiving daily sales summary emails on **Sunday morning** (reporting Saturday) and **Monday morning** (reporting Sunday). These are non-business days and should not trigger emails.

## Root Cause
The `send-daily-sales-summary` edge function is triggered every hour by a pg_cron job. It checks if it's 7 PM local time for each agency, but it does **not** check whether yesterday was a business day.

**Current trigger:**
- **pg_cron job**: `0 * * * *` (every hour, all 7 days)
- **Function logic**: Only checks `localHour === 19` (7 PM)

Meanwhile, the other daily summary function (`send_daily_summary`) correctly uses `shouldSendDailySummary()` from `_shared/business-days.ts`.

## Solution Overview
Add the same business day check that exists in `send_daily_summary` to the `send-daily-sales-summary` function.

**Logic to add:**
- Sunday morning (7 PM Saturday local) → Skip (Saturday is not a business day)
- Monday morning (7 PM Sunday local) → Skip (Sunday is not a business day)
- Tuesday-Saturday mornings → Send (Mon-Fri are business days)

## Implementation Steps

### Step 1: Import Business Day Utilities
Add import at top of `send-daily-sales-summary/index.ts`:
```typescript
import { shouldSendDailySummary, getDayName } from '../_shared/business-days.ts';
```

### Step 2: Add Business Day Check
After line 78 (the console log for starting), add a check that skips non-business day reports:

```typescript
// Check if today is a valid day to send summary
// Skip Sunday (would report on Saturday) and Monday (would report on Sunday)
const now = new Date();
if (!shouldSendDailySummary(now)) {
  const dayName = getDayName(now);
  console.log(`[send-daily-sales-summary] Skipping - today is ${dayName}, yesterday was not a business day`);
  return new Response(
    JSON.stringify({ 
      success: true, 
      skipped: true, 
      reason: 'Yesterday was not a business day (weekend)',
      today: dayName
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Step 3: Allow Force Test Override
Modify the check to respect the `forceTest` flag for testing purposes:

```typescript
if (!forceTest && !shouldSendDailySummary(now)) {
  // ... skip logic
}
```

## Email Schedule After Fix

| Day Email is Sent | Reports On | Action |
|-------------------|------------|--------|
| Sunday 7 PM | Saturday | **SKIP** (not a business day) |
| Monday 7 PM | Sunday | **SKIP** (not a business day) |
| Tuesday 7 PM | Monday | SEND ✅ |
| Wednesday 7 PM | Tuesday | SEND ✅ |
| Thursday 7 PM | Wednesday | SEND ✅ |
| Friday 7 PM | Thursday | SEND ✅ |
| Saturday 7 PM | Friday | SEND ✅ |

## Files Modified
1. `supabase/functions/send-daily-sales-summary/index.ts` - Add business day check

## No Changes Needed
- **pg_cron job**: Keep running every hour (the function itself will exit early on Sun/Mon)
- **GitHub Actions workflow**: Already correctly configured for Tue-Sat
- **`_shared/business-days.ts`**: Already has the correct logic

## Technical Notes

### Why not change the cron schedule?
The pg_cron job runs every hour because it handles multiple agencies in different timezones. Each agency needs the function to check if it's 7 PM in *their* timezone. Restricting the cron to only run Tue-Sat would still require the function-level check, and the current hourly approach is simpler.

### How `shouldSendDailySummary` works
```typescript
export function shouldSendDailySummary(today: Date): boolean {
  const dayOfWeek = today.getDay();
  // Skip Sunday (0) - would report on Saturday
  // Skip Monday (1) - would report on Sunday
  return dayOfWeek !== 0 && dayOfWeek !== 1;
}
```
- Returns `false` on Sunday (day 0)
- Returns `false` on Monday (day 1)
- Returns `true` on Tuesday through Saturday (days 2-6)

## Testing
After deployment, you can verify by:
1. Checking edge function logs on Sunday/Monday evenings - should show "Skipping" message
2. Using `forceTest` mode with a specific email to manually test the skip logic

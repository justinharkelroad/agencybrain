

# Fix Core 4 Not Saving in Challenge Page

## Problem
The Core 4 checkboxes in `/staff/challenge` don't save when clicked. The UI updates optimistically but nothing persists to the database.

**Root Cause:** The `handleCore4Toggle` function in `StaffChallenge.tsx` (line 182-192) is calling the edge function with `action: 'upsert'`, but this action **does not exist** in the `get_staff_core4_entries` edge function.

The edge function only supports these actions:
- `toggle` - Toggle a single domain on/off
- `fetch` - Fetch entries
- `fetch_missions` - Fetch missions
- `create_mission` / `update_mission_item` / `update_mission_status` - Manage missions

## Solution

Update `StaffChallenge.tsx` to use the existing `toggle` action instead of the non-existent `upsert` action.

---

## Code Changes

### File: `src/pages/staff/StaffChallenge.tsx`

**Lines 182-192 (current broken code):**
```typescript
const { error } = await supabase.functions.invoke('get_staff_core4_entries', {
  headers: { 'x-staff-session': sessionToken },
  body: {
    action: 'upsert',           // ← DOES NOT EXIST
    entry_date: todayStr,
    body: updatedCore4.body,
    being: updatedCore4.being,
    balance: updatedCore4.balance,
    business: updatedCore4.business,
  },
});
```

**Fix - use `toggle` action:**
```typescript
const { error } = await supabase.functions.invoke('get_staff_core4_entries', {
  headers: { 'x-staff-session': sessionToken },
  body: {
    action: 'toggle',           // ← Use existing action
    domain: key,                // ← Just pass which domain to toggle
  },
});
```

The `toggle` action already:
1. Gets or creates an entry for today
2. Toggles the specific domain (body_completed, being_completed, etc.)
3. Returns the updated entry

---

## Additional Cleanup

After fixing the toggle, we still need to **remove the duplicate Core 4 UI from the dashboard widget** (`ChallengeDashboardWidget.tsx`) as discussed earlier. The challenge page Core 4 will work correctly, and the dashboard will only show the original "Core 4 + Flow" card.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/staff/StaffChallenge.tsx` | Change `action: 'upsert'` to `action: 'toggle'` with `domain: key` |
| `src/components/challenge/ChallengeDashboardWidget.tsx` | Remove duplicate Core 4 section (as previously discussed) |

---

## Testing

After fix:
1. Go to `/staff/challenge`
2. Click any Core 4 checkbox (Body, Being, Balance, Business)
3. Checkbox should save and persist
4. The original "Core 4 + Flow" card on the dashboard should reflect the same data


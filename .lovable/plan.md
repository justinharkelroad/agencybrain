
# Replace Challenge Core 4 with Original Core 4 UI

## Root Causes Identified

### Backend Bug: Wrong Column Names
The `get-staff-challenge` edge function queries `staff_core4_entries` using incorrect column names:
- **Wrong**: `entry_date` → **Correct**: `date`
- **Wrong**: `body`, `being`, `balance`, `business` → **Correct**: `body_completed`, `being_completed`, `balance_completed`, `business_completed`

This causes Core 4 data to always return null, so the challenge page never shows correct completion status.

### Frontend Issue: Wrong UI Component
The challenge page (`StaffChallenge.tsx`) renders a custom checklist with checkboxes, while the existing `StaffCore4Card` component has the proper 2x2 gradient tile UI with THE SCORE and THE STREAKS that you expect.

---

## Solution

### 1. Fix Edge Function Column Names

Update `supabase/functions/get-staff-challenge/index.ts` to use correct column names:

**Lines 191-196 (today's entry):**
```typescript
// Before (broken):
.eq('entry_date', todayStr)

// After (fixed):
.eq('date', todayStr)
```

**Lines 200-205 (streak calculation):**
```typescript
// Before (broken):
.select('entry_date, body, being, balance, business')
.order('entry_date', { ascending: false })
// Check: log.body && log.being && log.balance && log.business

// After (fixed):
.select('date, body_completed, being_completed, balance_completed, business_completed')
.order('date', { ascending: false })
// Check: log.body_completed && log.being_completed && log.balance_completed && log.business_completed
```

### 2. Replace Custom Checklist with StaffCore4Card

Update `src/pages/staff/StaffChallenge.tsx`:

- Remove the custom "Daily Core 4" checklist section (lines 567-610)
- Remove related state (`core4Updating`), handler (`handleCore4Toggle`), and constants (`CORE4_ITEMS`)
- Import and render the existing `StaffCore4Card` component in the sidebar instead

The `StaffCore4Card` already:
- Uses the proper 2x2 gradient tile UI
- Shows THE SCORE (combined 35-point weekly)
- Shows THE STREAKS (Flow + Core 4)
- Calls `useStaffCore4Stats` which properly invokes `get_staff_core4_entries` with `action: 'toggle'`
- Auto-updates when any domain is clicked

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/get-staff-challenge/index.ts` | Fix column names: `date`, `body_completed`, etc. |
| `src/pages/staff/StaffChallenge.tsx` | Remove custom Core 4 checklist, import `StaffCore4Card` |

---

## Visual Result

**Before (custom checklist):**
```text
┌─────────────────────────────┐
│ Daily Core 4                │
│ ○ Body - Did you move?      │
│ ○ Being - Mindfulness?      │
│ ○ Balance - Relationship?   │
│ ○ Business - Action?        │
│ 🔥 X day streak!            │
└─────────────────────────────┘
```

**After (original Core 4 + Flow card):**
```text
┌─────────────────────────────┐
│ Core 4 + Flow     🔥3       │
│ Today: 2/4 • Week: 18/35    │
├──────────────┬──────────────┤
│ ▓▓ BODY ▓▓   │ ░░ BEING ░░  │
├──────────────┼──────────────┤
│ ▓▓ BALANCE ▓▓│ ░░ BUSINESS ░│
├──────────────┴──────────────┤
│ THE SCORE     THE STREAKS   │
│  ◐ 18/35     ⚡2   🔥3      │
└─────────────────────────────┘
```

Clicking any tile toggles it on/off, updates the score, and syncs with the database.

---

## Technical Details

### StaffCore4Card Component
- Located at `src/components/staff/StaffCore4Card.tsx`
- Uses `useStaffCore4Stats` hook for data fetching and toggling
- Displays combined Core 4 + Flow weekly score (35-point system)
- Shows current and longest streaks for both metrics

### Data Flow
1. User clicks a domain tile in StaffCore4Card
2. `toggleDomain()` from `useStaffCore4Stats` is called
3. Hook invokes `get_staff_core4_entries` edge function with `action: 'toggle'` and `domain: 'body'`
4. Edge function updates `staff_core4_entries` table
5. Hook receives updated entry and re-renders the UI

This ensures the challenge page uses the exact same Core 4 tracking as the rest of the staff portal.


# Plan: Rename "Stack" to "Flow" and Add Discovery Flow Integration

## Overview
This plan ensures **all users** (Staff, Managers, Agency Owners, and Key Employees) have the **exact same experience** when interacting with the 6-Week Challenge. The changes will:

1. Rename all "Discovery Stack" references to "Discovery Flow"
2. Add a "Start Discovery Flow" button for Friday lessons
3. Ensure users without a profile are prompted to complete it first

## Current Architecture Analysis

### Who Uses What
| User Type | Challenge Route | Component | Flow Profile Hook |
|-----------|-----------------|-----------|-------------------|
| Staff | `/staff/challenge` | `StaffChallenge.tsx` | `useStaffFlowProfile` |
| Manager | `/staff/challenge` | `StaffChallenge.tsx` | `useStaffFlowProfile` |
| Owner | `/staff/challenge` | `StaffChallenge.tsx` | `useStaffFlowProfile` |
| Key Employee | `/staff/challenge` | `StaffChallenge.tsx` | `useStaffFlowProfile` |

All challenge participants use the **same component and hook**, ensuring equal experience.

### Files Containing "Discovery Stack" Terminology

| File | Occurrences | Context |
|------|-------------|---------|
| `src/pages/staff/StaffChallenge.tsx` | 3 | Interface + 2 UI badges |
| `src/pages/training/ChallengeView.tsx` | 4 | Interface + 2 badges + 1 sidebar text |
| `src/pages/training/ChallengePurchase.tsx` | 1 | Feature list item |
| `src/pages/ChallengeLanding.tsx` | 3 | 3 pricing tier feature lists |
| Database column `challenge_lessons.is_discovery_stack` | 1 | Schema |

---

## Technical Changes

### Part 1: Terminology Updates

#### 1.1 StaffChallenge.tsx (Main Participant View)

**Location:** `src/pages/staff/StaffChallenge.tsx`

| Line | Current | New |
|------|---------|-----|
| 33 | `is_discovery_stack: boolean;` | `is_discovery_flow: boolean;` |
| 392-393 | `lesson.is_discovery_stack` / `"Discovery Stack"` | `lesson.is_discovery_flow` / `"Discovery Flow"` |
| 414-417 | `selectedLesson.is_discovery_stack` / `"Discovery Stack"` | `selectedLesson.is_discovery_flow` / `"Discovery Flow"` |

#### 1.2 ChallengeView.tsx (Owner Preview)

**Location:** `src/pages/training/ChallengeView.tsx`

| Line | Current | New |
|------|---------|-----|
| 33 | `is_discovery_stack: boolean;` | `is_discovery_flow: boolean;` |
| 233-234 | `lesson.is_discovery_stack` / `"Discovery Stack"` | `lesson.is_discovery_flow` / `"Discovery Flow"` |
| 255-258 | `selectedLesson.is_discovery_stack` / `"Discovery Stack"` | `selectedLesson.is_discovery_flow` / `"Discovery Flow"` |
| 372 | `"Weekly Discovery Stack reflections"` | `"Weekly Discovery Flow reflections"` |

#### 1.3 ChallengePurchase.tsx (Purchase Page)

**Location:** `src/pages/training/ChallengePurchase.tsx`

| Line | Current | New |
|------|---------|-----|
| 403 | `title: 'Discovery Stack'` | `title: 'Discovery Flow'` |
| 404 | `description: 'Weekly Friday reflections...'` | `description: 'Weekly Friday guided reflections to cement learning'` |

#### 1.4 ChallengeLanding.tsx (Public Landing Page)

**Location:** `src/pages/ChallengeLanding.tsx`

| Lines | Current | New |
|-------|---------|-----|
| 37 | `'Discovery Stack weekly reviews'` | `'Discovery Flow weekly reviews'` |
| 54 | `'Discovery Stack weekly reviews'` | `'Discovery Flow weekly reviews'` |
| 71 | `'Discovery Stack weekly reviews'` | `'Discovery Flow weekly reviews'` |

---

### Part 2: Add "Start Discovery Flow" Button (Friday Lessons)

#### 2.1 StaffChallenge.tsx - New Imports

Add at the top of the file:
```typescript
import { useStaffFlowProfile } from '@/hooks/useStaffFlowProfile';
import { Sparkles } from 'lucide-react';
```

#### 2.2 StaffChallenge.tsx - Hook Usage

Add after existing hooks (around line 100):
```typescript
const { hasProfile, loading: profileLoading } = useStaffFlowProfile();
```

#### 2.3 StaffChallenge.tsx - Button Logic

Replace the current "Mark as Complete" button section (lines 481-500) with conditional logic:

```typescript
{/* Discovery Flow Button - for Friday lessons that are not completed */}
{selectedLesson.is_discovery_flow && selectedLesson.challenge_progress?.status !== 'completed' && (
  <Button
    className="w-full mb-2"
    onClick={() => {
      if (!hasProfile) {
        navigate('/staff/flows/profile', { 
          state: { redirectTo: '/staff/flows/start/discovery' } 
        });
      } else {
        navigate('/staff/flows/start/discovery');
      }
    }}
  >
    <Sparkles className="h-4 w-4 mr-2" />
    Start Discovery Flow
  </Button>
)}

{/* Regular Mark Complete Button - for all lessons */}
{selectedLesson.challenge_progress?.status !== 'completed' && (
  <Button
    variant={selectedLesson.is_discovery_flow ? "outline" : "default"}
    className="w-full"
    onClick={handleMarkComplete}
    disabled={completing}
  >
    {completing ? (
      <>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Completing...
      </>
    ) : (
      <>
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Mark as Complete
      </>
    )}
  </Button>
)}
```

---

### Part 3: Database Schema Update

#### 3.1 Rename Column

SQL Migration:
```sql
-- Rename column from is_discovery_stack to is_discovery_flow
ALTER TABLE public.challenge_lessons 
  RENAME COLUMN is_discovery_stack TO is_discovery_flow;

-- Add a comment for documentation
COMMENT ON COLUMN public.challenge_lessons.is_discovery_flow IS 
  'Indicates Friday lessons that should link to the Discovery Flow';
```

---

### Part 4: Edge Function Update

#### 4.1 get-staff-challenge

**Location:** `supabase/functions/get-staff-challenge/index.ts`

The edge function queries `challenge_lessons` and returns the data. After the database column is renamed, the returned field will automatically be `is_discovery_flow` instead of `is_discovery_stack`.

No code changes needed if the function uses `SELECT *` or includes the column dynamically. If it explicitly maps fields, update the field name.

---

## User Flow After Changes

```text
User opens Friday lesson in Challenge
         │
         ▼
┌────────────────────────┐
│ is_discovery_flow?     │
└────────┬───────────────┘
    Yes  │       No
         ▼        ▼
┌───────────────┐  ┌───────────────┐
│ Show "Start   │  │ Show only     │
│ Discovery     │  │ "Mark as      │
│ Flow" button  │  │ Complete"     │
│ + "Mark as    │  │ button        │
│ Complete"     │  └───────────────┘
└───────┬───────┘
        │ Click "Start Discovery Flow"
        ▼
┌────────────────────────┐
│ hasProfile?            │
└────────┬───────────────┘
    No   │       Yes
         ▼        ▼
┌───────────────┐  ┌───────────────┐
│ Navigate to   │  │ Navigate to   │
│ /staff/flows/ │  │ /staff/flows/ │
│ profile       │  │ start/        │
│ (with         │  │ discovery     │
│ redirectTo)   │  └───────────────┘
└───────────────┘
```

---

## Summary of Changes

| File | Type | Description |
|------|------|-------------|
| `src/pages/staff/StaffChallenge.tsx` | UI + Logic | Rename terminology + add Discovery Flow button with profile check |
| `src/pages/training/ChallengeView.tsx` | UI | Rename "Discovery Stack" to "Discovery Flow" |
| `src/pages/training/ChallengePurchase.tsx` | UI | Rename in feature list |
| `src/pages/ChallengeLanding.tsx` | UI | Rename in 3 pricing tier descriptions |
| Database migration | Schema | Rename column `is_discovery_stack` to `is_discovery_flow` |
| Edge function | Backend | Automatic if using wildcard select; verify field mapping |

---

## Why This Ensures Equal Experience

1. **Single Component:** All user types (Staff, Manager, Owner, Key Employee) use `StaffChallenge.tsx`
2. **Single Hook:** All user types use `useStaffFlowProfile` for profile checking
3. **Same Flow Routes:** Everyone navigates to `/staff/flows/profile` or `/staff/flows/start/discovery`
4. **Consistent Terminology:** "Discovery Flow" appears everywhere for all users

---

## Files NOT Requiring Changes

- `useFlowProfile.ts` - Only used by non-staff flows routes (regular owner Flows)
- `StaffFlows.tsx` - Already has correct profile redirect logic (reused pattern)
- `flow_templates` table - Already has "Discovery" template with slug `discovery`

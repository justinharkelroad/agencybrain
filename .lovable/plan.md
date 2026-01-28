
# Fix: Complete "Discovery Stack" to "Discovery Flow" Rename

## What Went Wrong

The previous implementation had a **critical data mismatch**:

1. **Frontend was updated** - `StaffChallenge.tsx` looks for `is_discovery_flow` (line 35, 486)
2. **Backend was NOT updated** - The `get-staff-challenge` edge function still returns `is_discovery_stack` (line 123)
3. **Result**: The button condition `selectedLesson.is_discovery_flow` is always `undefined` because the API returns `is_discovery_stack`

Additionally, the image you shared shows `ChallengeView.tsx` line 372 which the code I just read shows IS correctly updated to "Discovery Flow" - but this may be displaying cached/old content. The database migration to rename the column also needs verification.

## Files Still Containing "Discovery Stack"

| File | Location | Issue |
|------|----------|-------|
| `supabase/functions/get-staff-challenge/index.ts` | Line 123 | **CRITICAL**: Returns `is_discovery_stack` instead of `is_discovery_flow` |
| `supabase/functions/challenge-send-daily-emails/index.ts` | Lines 83-86 | Email template says "Friday Discovery Stack" |
| `src/components/challenge/admin/ChallengeLessonEditor.tsx` | Lines 28, 165-169 | Admin editor uses old property name and label |
| `src/pages/admin/challenge-tabs/ChallengeContentTab.tsx` | Lines 146-150 | Admin content tab shows "Discovery Stack" badge |
| `src/hooks/useChallengeAdmin.ts` | Line 41 | Interface uses `is_discovery_stack` |
| `supabase/migrations/20251209135424_*.sql` | Lines 12, 68, 89 | Historical migration (can be ignored) |
| `src/hooks/useFlowSession.ts` | Line 187 | Uses `stack_title` interpolation key |
| `src/hooks/useStaffFlowSession.ts` | Line 192 | Uses `stack_title` interpolation key |

---

## Fix Plan

### Part 1: Fix the Critical Backend Mismatch

**File: `supabase/functions/get-staff-challenge/index.ts`**

Line 123: Change `is_discovery_stack` to `is_discovery_flow`

```typescript
// Before (line 123)
is_discovery_stack,

// After
is_discovery_flow,
```

This will make the API return `is_discovery_flow` which the frontend is expecting, and the button will appear for Friday lessons.

---

### Part 2: Fix Admin Interface

**File: `src/components/challenge/admin/ChallengeLessonEditor.tsx`**

| Line | Current | New |
|------|---------|-----|
| 28 | `is_discovery_stack: lesson.is_discovery_stack` | `is_discovery_flow: lesson.is_discovery_flow` |
| 165 | `id="discovery_stack"` | `id="discovery_flow"` |
| 166 | `checked={form.is_discovery_stack}` | `checked={form.is_discovery_flow}` |
| 167 | `setForm({ ...form, is_discovery_stack: checked })` | `setForm({ ...form, is_discovery_flow: checked })` |
| 169 | `"Discovery Stack Day (Friday)"` | `"Discovery Flow Day (Friday)"` |

**File: `src/pages/admin/challenge-tabs/ChallengeContentTab.tsx`**

| Line | Current | New |
|------|---------|-----|
| 146 | `lesson.is_discovery_stack` | `lesson.is_discovery_flow` |
| 149 | `Discovery Stack` | `Discovery Flow` |

**File: `src/hooks/useChallengeAdmin.ts`**

| Line | Current | New |
|------|---------|-----|
| 41 | `is_discovery_stack: boolean` | `is_discovery_flow: boolean` |

---

### Part 3: Fix Email Template

**File: `supabase/functions/challenge-send-daily-emails/index.ts`**

| Line | Current | New |
|------|---------|-----|
| 83 | `lesson.is_discovery_stack` | `lesson.is_discovery_flow` |
| 85 | `Friday Discovery Stack` | `Friday Discovery Flow` |
| 86 | `weekly Discovery Stack reflection` | `weekly Discovery Flow reflection` |

---

### Part 4: Update Flow Session Hooks (Optional - Lower Priority)

The `stack_title` interpolation key in the flow template questions is a database value that would require updating the `flow_templates` table. Since these hooks check for BOTH `stack_title` and `title`, this is backwards compatible and can be addressed separately.

---

## Summary of Required Changes

| Priority | File | Type | Description |
|----------|------|------|-------------|
| CRITICAL | `get-staff-challenge/index.ts` | Edge Function | Change field name to `is_discovery_flow` |
| HIGH | `ChallengeLessonEditor.tsx` | Admin UI | Update property names and label |
| HIGH | `ChallengeContentTab.tsx` | Admin UI | Update badge text |
| HIGH | `useChallengeAdmin.ts` | Hook | Update interface property |
| HIGH | `challenge-send-daily-emails/index.ts` | Edge Function | Update email template text |
| LOW | Flow session hooks | Hooks | `stack_title` key (backwards compatible) |

---

## Why the Button Didn't Appear

The "Start Discovery Flow" button code EXISTS in `StaffChallenge.tsx` (lines 486-501), but it never renders because:

```typescript
{selectedLesson.is_discovery_flow && ...}  // Always false!
```

The data from the API returns `{ is_discovery_stack: true }` but the frontend checks `is_discovery_flow`. Once the edge function is updated to return `is_discovery_flow`, the button will appear on Friday lessons.


# Fix Challenge Lesson Completion and Core 4 Duplication

## Problem Summary

You've identified three issues:

1. **Lesson Completion Bug**: The "Mark as Complete" button only updates local state and can be clicked repeatedly, incrementing the count each time without saving to the database.

2. **Date Allocation**: Your challenge started on Monday, January 26, 2026. Week 2 Monday (Day 6) correctly falls on Monday, February 2, 2026. The business-day calculation is working properly.

3. **Duplicate Core 4**: The challenge added its own Core 4 tracking (`challenge_core4_logs`) instead of using the existing staff Core 4 system (`staff_core4_entries`). This means challenge participants' Core 4 completions don't count toward their overall 35-point weekly score.

---

## Solution Overview

### Fix 1: Complete the Lesson Completion Feature

Create an edge function to save lesson completions to the database and update the frontend to use it properly.

### Fix 2: Unify Core 4 Tracking

Replace the challenge-specific Core 4 with the existing `staff_core4_entries` system so completions count toward the standard 35-point weekly score.

---

## Technical Implementation

### Part 1: Create Lesson Completion Edge Function

**New File:** `supabase/functions/challenge-complete-lesson/index.ts`

This function will:
- Accept `assignment_id`, `lesson_id`, and `reflection_responses`
- Verify the staff user owns this assignment
- Update `challenge_progress` table with `status: 'completed'`
- Unlock the next lesson if applicable
- Return updated progress stats

Key database update:
```text
UPDATE challenge_progress
SET status = 'completed',
    completed_at = NOW(),
    reflection_response = [user's answers]
WHERE assignment_id = [id] AND lesson_id = [id]
```

### Part 2: Update StaffChallenge.tsx

**File:** `src/pages/staff/StaffChallenge.tsx`

Changes to `handleMarkComplete`:
1. Call the new edge function before updating local state
2. Only update local state on success
3. Check if lesson is already completed before allowing click (prevent duplicates)

**Before (current broken code):**
```typescript
const handleMarkComplete = async () => {
  // TODO: Implement lesson completion edge function
  // For now, just update local state  ← THIS IS THE BUG
  toast.success('Lesson marked as complete!');
  setData(prev => ({
    ...prev,
    progress: { completed_lessons: prev.progress.completed_lessons + 1 }  // ← Increments every click
  }));
};
```

**After (fixed):**
```typescript
const handleMarkComplete = async () => {
  // Guard: don't complete again if already completed
  if (selectedLesson.challenge_progress?.status === 'completed') return;
  
  // Call edge function to save to database
  const response = await supabase.functions.invoke('challenge-complete-lesson', {
    body: { assignment_id, lesson_id, reflection_responses }
  });
  
  if (response.error) throw response.error;
  
  // Only update local state on success
  setData(prev => /* update from response */);
};
```

### Part 3: Unify Core 4 Tracking

**Option A: Use Existing System (Recommended)**

Modify the challenge portal to use `staff_core4_entries` instead of `challenge_core4_logs`:

1. **Update `StaffChallenge.tsx`**: Replace calls to `challenge-update-core4` edge function with calls to `get_staff_core4_entries` (existing)
2. **Update `get-staff-challenge` edge function**: Fetch Core 4 data from `staff_core4_entries` instead of `challenge_core4_logs`
3. **Deprecate** `challenge_core4_logs` table and `challenge-update-core4` function

This ensures:
- Challenge Core 4 completions count toward the 35-point weekly score
- Staff sees consistent Core 4 stats across `/staff/core4` and `/staff/challenge`
- Agency owners see unified team Core 4 data

**Dashboard Impact:**
The "Daily Core 4" section in the challenge portal will show the same completion status as the existing `/staff/core4` page, eliminating the duplicate tracking.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/challenge-complete-lesson/index.ts` | **Create** | Save lesson completion to database |
| `supabase/config.toml` | Modify | Register new edge function |
| `src/pages/staff/StaffChallenge.tsx` | Modify | Fix handleMarkComplete, unify Core 4 |
| `supabase/functions/get-staff-challenge/index.ts` | Modify | Fetch from `staff_core4_entries` instead of `challenge_core4_logs` |

---

## Date Allocation Confirmation

Your assignment started **January 26, 2026 (Monday)**. Here's the business-day mapping:

```text
Week 1: Days 1-5
  Mon Jan 26 (Day 1) - Week 1 Monday: Foundation
  Tue Jan 27 (Day 2) - Week 1 Tuesday: Foundation
  Wed Jan 28 (Day 3) - Week 1 Wednesday: Foundation
  Thu Jan 29 (Day 4) - Week 1 Thursday: Foundation
  Fri Jan 30 (Day 5) - Week 1 Friday: Foundation

Week 2: Days 6-10
  Mon Feb 2  (Day 6)  - Week 2 Monday: Consistency    ← Correct!
  Tue Feb 3  (Day 7)  - Week 2 Tuesday: Consistency
  Wed Feb 4  (Day 8)  - Week 2 Wednesday: Consistency
  Thu Feb 5  (Day 9)  - Week 2 Thursday: Consistency
  Fri Feb 6  (Day 10) - Week 2 Friday: Consistency

Week 3: Days 11-15
  Mon Feb 9  (Day 11) - Week 3 Monday: Discipline     ← Correct!
  ...
```

The system correctly skips weekends (Sat/Sun) when allocating business days.

---

## Edge Cases Handled

1. **Double-click prevention**: Check if lesson is already completed before allowing action
2. **Network failure**: Only update local state after successful database save
3. **Reflection data**: Save user's reflection answers to `challenge_progress.reflection_response`
4. **Next lesson unlock**: The existing database trigger handles unlocking based on completion

---

## Implementation Order

1. Create `challenge-complete-lesson` edge function
2. Update `StaffChallenge.tsx` to call the new function
3. Update Core 4 to use unified `staff_core4_entries`
4. Test lesson completion and Core 4 unification
5. Optionally clean up deprecated `challenge_core4_logs` table

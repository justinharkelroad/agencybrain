
## Goal
Make the **“Assign To”** dropdown in the **Apply Onboarding Sequence** modal include the **agency owner (you)** and other non-staff “regular users”, while keeping existing staff assignment behavior intact and avoiding new crashes.

## What I see (based on code + your screenshot)
- The dropdown you’re looking at is in **`src/components/onboarding/ApplySequenceModal.tsx`**.
- That dropdown is populated **only from `staff_users`**:
  - `ApplySequenceModal.tsx` queries `staff_users` where `is_active = true`.
  - Agency owners generally exist in **`profiles`** and **`team_members`**, but *not necessarily* in `staff_users`.
- The edge function that actually applies a sequence is **`supabase/functions/assign_onboarding_sequence/index.ts`** and it **requires** `assigned_to_staff_user_id` and validates it against `staff_users`.
- The database schema already supports both:
  - `onboarding_instances.assigned_to_user_id` (profiles)
  - `onboarding_instances.assigned_to_staff_user_id` (staff_users)
  But the **frontend + edge function are currently hardcoded to staff_users only**, which is why you don’t see yourself.

## High-level fix (no changes to sale matching logic)
We will **not** touch any LQS matching logic. This is strictly about onboarding sequence “assignee” selection.

We’ll implement “assignee can be either”:
- **Staff user** (existing behavior)
- **Regular user profile** (so owners/managers/key employees can appear)

## Implementation steps

### 1) Update the ApplySequenceModal UI to list both Staff Users and Owner/Manager Profiles
**File:** `src/components/onboarding/ApplySequenceModal.tsx`

**Changes:**
- Replace the single `staff_users` query with two queries that run when the modal is open:
  1) `staff_users` (same as today)
  2) `profiles` for the same `agency_id` (to include owner)
- Build a combined list of options:
  - Example internal shape:
    - `{ type: 'staff', id: staffUser.id, label: display_name || username }`
    - `{ type: 'user', id: profile.id, label: full_name || email || '(Unnamed user)' }`
- Store selection as a composite value so IDs don’t collide:
  - Example: `staff:<uuid>` or `user:<uuid>`
- Render labels clearly so it’s obvious who is who:
  - Example: `Justin E Harkelroad (Owner)` or `Jane Doe (Staff)`
  - We can add a small badge/tag in the dropdown row.

**Result:** You will see yourself in that dropdown even if you don’t have a `staff_users` record.

### 2) Update assign_onboarding_sequence edge function to accept either staff_user or profile user
**File:** `supabase/functions/assign_onboarding_sequence/index.ts`

**Changes:**
- Change request payload rules:
  - Allow `assigned_to_staff_user_id` OR `assigned_to_user_id`
  - Require exactly one of them (to avoid ambiguity)
- Validation logic:
  - If assigning to staff:
    - keep current `staff_users` validation
  - If assigning to user:
    - validate `profiles.id = assigned_to_user_id`
    - confirm that profile belongs to the same `agency_id`
- Insert onboarding_instances with the correct field set:
  - If user assignee: set `assigned_to_user_id`
  - If staff assignee: set `assigned_to_staff_user_id`

**Why this is safe:** The DB trigger that creates onboarding tasks already copies both columns from the instance into tasks, so it works as-designed.

### 3) Ensure owners can actually see tasks assigned to their profile (so the feature isn’t “write-only”)
Right now, the owner-facing onboarding tasks UI is staff-only in multiple places.

**Files:**
- `src/hooks/useOnboardingTasks.ts`
- `src/pages/agency/OnboardingTasks.tsx`
- (and any small related “staff users for filter” hook found via search)

**Changes:**
- In `useOnboardingTasks` and `useOnboardingTasksToday`:
  - Join assignee from both:
    - `staff_users!assigned_to_staff_user_id(...)`
    - `profiles!assigned_to_user_id(...)`
  - Update filtering so it can filter by either:
    - `assigned_to_staff_user_id = X`
    - `assigned_to_user_id = Y`
  - Adjust types to reflect that assignee can be “staff” or “user”.
- In `OnboardingTasks.tsx`:
  - The “My tasks” mode currently relies on a “linked staff account” concept and falls back to a dummy UUID.
  - Change “My tasks” for owners to use:
    - `assigned_to_user_id = currentUser.id`
  - Update the “All team members” filter dropdown to include both staff users and user profiles.

**Result:** If you assign sequences to yourself (owner), the tasks will show up correctly for you.

### 4) Verification checklist (what we’ll test after implementing)
1. As agency owner, create a sale → Apply Sequence modal opens.
2. “Assign To” dropdown includes you (owner) and staff users.
3. Choose yourself → Apply Sequence → success toast.
4. Visit Onboarding Tasks page:
   - “My tasks” shows tasks assigned to your owner profile.
   - “All agency” view can filter by you and by staff users.
5. Confirm no regressions:
   - Assigning to staff still works.
   - Staff portal flows using onboarding tasks still work.

## Notes on why you didn’t see yourself
This is not a caching issue in this case—the modal is **coded to only show `staff_users`**, and owners typically don’t have a `staff_users` entry. So you are excluded by design/implementation, not by your permissions.

## Scope boundaries (explicitly not touching)
- No changes to sales creation logic beyond enabling the modal’s assignment properly.
- No changes to LQS matching.
- No changes to “producer/team member assignment” dropdown in Add Sale form (unless it still reproduces after this; it’s a separate control fed by `team_members`).

## Files expected to change
- `src/components/onboarding/ApplySequenceModal.tsx`
- `supabase/functions/assign_onboarding_sequence/index.ts`
- `src/hooks/useOnboardingTasks.ts`
- `src/pages/agency/OnboardingTasks.tsx`
- Potentially one small hook that provides assignee options for filters (if present)


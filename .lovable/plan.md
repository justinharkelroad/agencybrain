
# Plan: Add Discovery Flow Toggle to Sales Experience

## Problem
The `is_discovery_flow` database column exists in `sales_experience_lessons`, but the UI code was never updated to:
1. Show an admin toggle in `SEContentTab.tsx`
2. Display the Discovery Flow button in `StaffSalesLesson.tsx`

## Changes Required

### 1. Update SEContentTab.tsx (Admin UI)

**Add to Lesson interface (line ~70-82):**
```typescript
is_discovery_flow: boolean;
```

**Add toggle switch in the edit dialog (after the "Visible to Staff" switch, ~line 579):**
- Only show for Friday lessons (`editingLesson.day_of_week === 5`)
- Label: "Discovery Flow Day"
- Description: "Staff will see a button to start the Discovery Flow"

**Add badge in lesson list (after the Staff badge, ~line 243):**
- Purple "Discovery Flow" badge with a Sparkles icon

### 2. Update StaffSalesLesson.tsx (Staff View)

**Add to LessonData and ApiLesson interfaces:**
```typescript
is_discovery_flow: boolean;
```

**Update fetchLessonData to include is_discovery_flow (~line 133):**
- Pass through the `is_discovery_flow` property from the API

**Add Discovery Flow button section (before or after the Quiz section):**
- Only show when `lesson.is_discovery_flow === true` and lesson is not completed
- Button: "Start Discovery Flow" with Sparkles icon
- Clicking navigates to `/staff/flows/start/discovery` (or profile setup if needed)
- Import and use `useStaffFlowProfile` hook to check profile status

### 3. Update Edge Function (if needed)
Verify `get-staff-sales-lessons` returns `is_discovery_flow` field.

## Files to Modify
1. `src/pages/admin/sales-experience-tabs/SEContentTab.tsx`
2. `src/pages/staff/StaffSalesLesson.tsx`
3. `supabase/functions/get-staff-sales-lessons/index.ts` (verify/update)

## Technical Notes
- The database already has the `is_discovery_flow` boolean column (default: `false`)
- The challenge system (`StaffChallenge.tsx`, `ChallengeContentTab.tsx`) has a working implementation to reference
- Use `useStaffFlowProfile` hook (already exists) to determine if user needs profile setup before starting flow

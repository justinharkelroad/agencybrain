# Plan: Add Discovery Flow Toggle to Sales Experience

## ✅ COMPLETED

All changes have been implemented:

### 1. SEContentTab.tsx (Admin UI) ✅
- Added `is_discovery_flow: boolean` to Lesson interface
- Added `Sparkles` icon import
- Added purple "Discovery Flow" badge in lesson list (visible when `is_discovery_flow` is true)
- Added toggle switch in edit dialog (only visible for Friday lessons, `day_of_week === 5`)

### 2. StaffSalesLesson.tsx (Staff View) ✅
- Added `is_discovery_flow: boolean` to LessonData and ApiLesson interfaces
- Imported `useStaffFlowProfile` hook
- Added Discovery Flow button section (visible when `is_discovery_flow === true` and lesson not completed)
- Button navigates to profile setup or directly to flow start based on profile status

### 3. Edge Function (get-staff-sales-lessons) ✅
- Added `is_discovery_flow` field to the returned lesson data

## Technical Notes
- The toggle only appears for Friday lessons (`day_of_week === 5`)
- Staff see a purple-themed card with "Start Discovery Flow" button
- Users without a flow profile are redirected to `/staff/flows/profile` first
- Users with a profile go directly to `/staff/flows/start/discovery`

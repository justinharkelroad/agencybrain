# 8-Week Sales Experience Implementation Handoff

## Overview
Implementing the 8-Week Sales Experience coaching program as a premium, invite-only feature for coached agency owners/managers with time-gated staff training.

---

## Completed Work

### 1. Database Migration
**File:** `supabase/migrations/20260202060000_sales_experience_tables.sql`

Created comprehensive database schema including:
- **Enums:** `sales_experience_assignment_status`, `sales_experience_progress_status`, `sales_experience_email_status`, `sales_experience_sender_type`, `sales_experience_pillar`, `sales_experience_file_type`
- **Tables:**
  - `sales_experience_assignments` - Agency enrollment in the 8-week program
  - `sales_experience_modules` - 8 weekly modules (seeded with content)
  - `sales_experience_lessons` - 3 per week (Mon/Wed/Fri = 24 total, seeded with placeholders)
  - `sales_experience_resources` - Documents per module
  - `sales_experience_transcripts` - Zoom meeting transcripts with AI summaries
  - `sales_experience_ai_prompts` - Admin-editable AI prompts (seeded with 3 prompts)
  - `sales_experience_owner_progress` - Owner/Manager lesson tracking
  - `sales_experience_staff_progress` - Staff lesson tracking with time-gating
  - `sales_experience_quiz_attempts` - Staff quiz history
  - `sales_experience_messages` - Coach to Agency messaging
  - `sales_experience_email_templates` - Editable email templates (seeded with 4 templates)
  - `sales_experience_email_queue` - Scheduled email queue
- **Functions:**
  - `get_sales_experience_business_day()` - Calculate business days
  - `is_sales_experience_lesson_unlocked()` - Time-gating logic (Mon/Wed/Fri)
  - `get_sales_experience_current_week()` - Get current week number
  - `has_sales_experience_access()` - Check user access
- **Triggers:** Auto-initialize staff progress, queue lesson emails
- **RLS Policies:** Agency-scoped access, admin-only for management tables

### 2. Access Hook
**File:** `src/hooks/useSalesExperienceAccess.ts`

- `useSalesExperienceAccess()` - Returns `{ hasAccess, assignment, currentWeek, isActive, isPending, isLoading, error }`
- `isLessonUnlocked()` - Helper to check if a lesson is unlocked based on time-gating
- `calculateCurrentWeek()` - Calculate which week the assignment is in

### 3. Navigation Updates
**File:** `src/config/navigation.ts`

- Added `salesExperienceAccess?: boolean` flag to `NavItem` and `NavFolder` types
- Added imports: `Trophy`, `FileText`, `MessageSquare`
- Added full "8-Week Experience" folder with:
  - Overview & Progress link
  - Week 1-8 subfolders (each with Lessons, Documents, Transcript)
  - Coach Messages link
  - Team Quiz Results link

### 4. Sidebar Access Updates
**File:** `src/hooks/useSidebarAccess.ts`

- Added `SidebarFilterOptions` interface with `hasSalesExperienceAccess` option
- Updated `checkItemAccess()` to filter items with `salesExperienceAccess` flag
- Updated `filterNavigation()` to check folder-level `salesExperienceAccess`

**File:** `src/components/AppSidebar.tsx`

- Added import for `useSalesExperienceAccess`
- Added `hasSalesExperienceAccess` from hook
- Updated `filterNavigation` call to pass `hasSalesExperienceAccess` in options object
- Updated `useMemo` dependency array

### 5. Owner/Manager Pages
**Directory:** `src/pages/sales-experience/`

| File | Purpose |
|------|---------|
| `index.ts` | Exports all pages |
| `SalesExperienceOverview.tsx` | Dashboard with 8-week progress timeline, quick actions |
| `SalesExperienceWeek.tsx` | Week detail page with lessons list |
| `SalesExperienceDocuments.tsx` | Downloadable resources per week |
| `SalesExperienceTranscript.tsx` | Zoom transcript with AI summary, action items |
| `SalesExperienceMessages.tsx` | Chat interface with coach |
| `SalesExperienceTeamProgress.tsx` | Staff quiz results, completion rates |

### 6. Staff Training Pages
**Directory:** `src/pages/staff/`

| File | Purpose |
|------|---------|
| `StaffSalesTraining.tsx` | Lesson list with time-gating, progress tracking |
| `StaffSalesLesson.tsx` | Lesson detail with video, content, quiz submission |

### 7. Routes Added
**File:** `src/App.tsx`

Added imports and routes for:
- `/sales-experience` - Overview
- `/sales-experience/week/:week` - Week detail
- `/sales-experience/week/:week/documents` - Documents
- `/sales-experience/week/:week/transcript` - Transcript
- `/sales-experience/messages` - Messages
- `/sales-experience/team-progress` - Team progress
- `/staff/sales-training` - Staff training list
- `/staff/sales-training/lesson/:id` - Staff lesson detail

### 8. Admin Pages (Partial)
**Files Created:**
- `src/pages/admin/AdminSalesExperience.tsx` - Main admin page with tabs
- `src/pages/admin/sales-experience-tabs/SEAssignmentsTab.tsx` - Assign agencies, manage status
- `src/pages/admin/sales-experience-tabs/SEContentTab.tsx` - Edit lessons content

---

## Currently In Progress

### Admin Sales Experience Pages (Task #7)
**Missing Files:**
- `src/pages/admin/sales-experience-tabs/SEMessagesTab.tsx` - Send messages to all participants
- `src/pages/admin/sales-experience-tabs/SEAnalyticsTab.tsx` - View participation analytics

**Missing Routes in App.tsx:**
- `/admin/sales-experience` route not yet added

**Missing Admin Sidebar Item:**
- Need to add "Sales Experience" to `adminOnlyItems` array in `AppSidebar.tsx`

---

## Remaining Work

### Task #8: Edge Functions
**Directory:** `supabase/functions/`

| Function | Purpose |
|----------|---------|
| `get-sales-experience/` | Fetch assignment, modules, lessons, progress for owner |
| `get-staff-sales-lessons/` | Fetch time-gated lessons for staff |
| `complete-sales-lesson/` | Mark lesson complete (start/complete actions) |
| `submit-sales-quiz/` | Submit quiz, AI evaluates, stores score |
| `send-sales-experience-messages/` | CRUD for coach ↔ owner messaging |
| `upload-sales-transcript/` | Store Zoom transcript with AI summarization |

### Task #10: Reusable Components
**Directory:** `src/components/sales-experience/`

Consider creating shared components for:
- Week timeline visualization
- Lesson card component
- Quiz component
- Progress indicators

### Additional Admin Pages
**Files Needed:**
- `src/pages/admin/AdminSalesExperiencePrompts.tsx` - Edit AI prompts
- `src/pages/admin/AdminSalesExperienceTemplates.tsx` - Edit email templates

### Email Cron Job
- `send-sales-lesson-emails/` edge function for Mon/Wed/Fri lesson reminders

### Config File Updates
- Add new edge functions to `supabase/config.toml`

---

## Key Decisions & Patterns

### 1. Time-Gating Logic
- Staff lessons unlock Mon (day_of_week=1), Wed (day_of_week=3), Fri (day_of_week=5)
- Uses business day calculation (excludes weekends)
- Week 1 = business days 1-5, Week 2 = days 6-10, etc.

### 2. Separate from Challenge System
- New tables rather than extending challenge tables
- Different unlock cadence (Mon/Wed/Fri vs daily)
- Owner-focused vs staff-focused

### 3. Sidebar Visibility
- Uses `salesExperienceAccess` flag (similar to `challengeAccess`)
- Folder only appears for agencies with active/pending assignment
- Staff don't see sidebar - access via `/staff/sales-training`

### 4. API Pattern for Staff
- Staff pages call edge functions with `sessionToken` (not Supabase auth)
- Pattern follows existing `StaffChallenge.tsx`

### 5. Three Pillars Structure
- Weeks 1-3: Sales Process (`sales_process`)
- Weeks 4-5: Accountability (`accountability`)
- Weeks 6-8: Coaching Cadence (`coaching_cadence`)

---

## Exact Next Steps

1. **Finish Admin Tab Components:**
   ```bash
   # Create these files:
   src/pages/admin/sales-experience-tabs/SEMessagesTab.tsx
   src/pages/admin/sales-experience-tabs/SEAnalyticsTab.tsx
   ```

2. **Add Admin Route to App.tsx:**
   ```tsx
   <Route path="/admin/sales-experience" element={
     <ProtectedRoute requireAdmin>
       <SidebarLayout>
         <AdminSalesExperience />
       </SidebarLayout>
     </ProtectedRoute>
   } />
   ```

3. **Add Admin Sidebar Item:**
   In `src/components/AppSidebar.tsx`, add to `adminOnlyItems`:
   ```tsx
   { title: "Sales Experience", url: "/admin/sales-experience", icon: Trophy },
   ```

4. **Create Edge Functions** (highest priority after admin pages):
   - Start with `get-sales-experience` (owner data)
   - Then `get-staff-sales-lessons` (staff data with time-gating)
   - Then `submit-sales-quiz` (quiz submission)

5. **Test Locally:**
   ```bash
   npm run dev              # Frontend
   supabase start           # Local DB
   supabase db reset        # Apply migration
   ```

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `src/config/navigation.ts` | Added types, icons, full nav structure |
| `src/hooks/useSidebarAccess.ts` | Added SidebarFilterOptions, salesExperienceAccess checks |
| `src/components/AppSidebar.tsx` | Added hook import, filter options |
| `src/App.tsx` | Added imports and 8 new routes |

## Files Created (Summary)

| Path | Count |
|------|-------|
| `supabase/migrations/` | 1 file |
| `src/hooks/` | 1 file |
| `src/pages/sales-experience/` | 7 files |
| `src/pages/staff/` | 2 files |
| `src/pages/admin/` | 1 file |
| `src/pages/admin/sales-experience-tabs/` | 2 files |
| **Total** | **14 files** |

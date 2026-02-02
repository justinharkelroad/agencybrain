# 8 Week Sales Experience - Implementation Handoff

## Overview
Premium, invite-only coaching program for agency owners/managers with time-gated staff training. Features include video lessons, quizzes with AI feedback, coach messaging, and progress tracking.

---

## Completed Work

### 1. Database Schema
**File:** `supabase/migrations/20260202060000_sales_experience_tables.sql`

**Tables Created:**
- `sales_experience_assignments` - Agency enrollment (start_date must be Monday)
- `sales_experience_modules` - 8 weekly modules (seeded)
- `sales_experience_lessons` - 24 lessons (3 per week: Mon/Wed/Fri, seeded)
- `sales_experience_resources` - Documents per module
- `sales_experience_transcripts` - Zoom transcripts with AI summaries
- `sales_experience_ai_prompts` - Admin-editable AI prompts
- `sales_experience_owner_progress` - Owner/Manager lesson tracking
- `sales_experience_staff_progress` - Staff lesson tracking with time-gating
- `sales_experience_quiz_attempts` - Staff quiz history
- `sales_experience_messages` - Coach ↔ Owner messaging
- `sales_experience_email_templates` - Editable email templates
- `sales_experience_email_queue` - Scheduled email queue

**Functions:**
- `get_sales_experience_business_day()` - Calculate business days
- `is_sales_experience_lesson_unlocked()` - Time-gating logic
- `get_sales_experience_current_week()` - Get current week number
- `has_sales_experience_access()` - Check user access

**RLS Fix:** `supabase/migrations/20260202070000_fix_se_admin_rls.sql`
- Fixed admin policies to use `user_roles` table (not `profiles.role`)

---

### 2. Edge Functions (All Deployed)
**Directory:** `supabase/functions/`

| Function | Auth | Purpose |
|----------|------|---------|
| `get-sales-experience/index.ts` | JWT Bearer | Owner fetches assignment, modules, lessons, progress |
| `get-staff-sales-lessons/index.ts` | x-staff-session | Staff fetches time-gated lessons |
| `submit-sales-quiz/index.ts` | x-staff-session | Quiz submission with **Claude AI feedback** + email queue |
| `complete-sales-lesson/index.ts` | Both | Marks lessons as started/completed |
| `sales-experience-messages/index.ts` | JWT Bearer | Coach ↔ owner messaging CRUD |
| `upload-sales-transcript/index.ts` | JWT (Admin) | Upload Zoom transcript with AI summary |

**Key Features in `submit-sales-quiz`:**
- Uses Claude API (claude-3-haiku) for personalized feedback based on lesson content and answers
- Queues email notifications to agency owner and staff member
- Falls back to template feedback if ANTHROPIC_API_KEY not set

---

### 3. Access Control Hook
**File:** `src/hooks/useSalesExperienceAccess.ts`

- `useSalesExperienceAccess()` - Returns `{ hasAccess, assignment, currentWeek, isActive, isPending, isLoading, error }`
- `isLessonUnlocked()` - Helper for time-gating checks
- `calculateCurrentWeek()` - Business day calculation

---

### 4. Navigation & Sidebar

**Files Modified:**
- `src/config/navigation.ts` - Added `salesExperienceAccess` flag, Trophy icon, staff nav item
- `src/hooks/useSidebarAccess.ts` - Added `SidebarFilterOptions` interface
- `src/components/AppSidebar.tsx` - Added hook import, filter options, admin sidebar item

**Staff Navigation Item:**
```typescript
{
  id: 'staff-sales-training',
  title: '8 Week Sales Experience',
  icon: Trophy,
  url: '/staff/sales-training',
  access: { staff: true, manager: true, owner: true },
}
```
Located in Training folder of staff sidebar.

---

### 5. Owner/Manager Pages
**Directory:** `src/pages/sales-experience/`

| File | Purpose |
|------|---------|
| `index.ts` | Exports all pages |
| `SalesExperienceOverview.tsx` | Dashboard with 8-week progress timeline |
| `SalesExperienceWeek.tsx` | Week detail with lessons, **modal for viewing content/video** |
| `SalesExperienceDocuments.tsx` | Downloadable resources per week |
| `SalesExperienceTranscript.tsx` | Zoom transcript with AI summary |
| `SalesExperienceMessages.tsx` | Chat interface with coach |
| `SalesExperienceTeamProgress.tsx` | Staff quiz results, completion rates |

**Key Fix in `SalesExperienceWeek.tsx`:**
- Added `selectedLesson` state and Dialog modal
- Watch/View buttons now open modal with video embed + content
- Supports YouTube, Vimeo, Loom video platforms

---

### 6. Staff Training Pages
**Directory:** `src/pages/staff/`

| File | Purpose |
|------|---------|
| `StaffSalesTraining.tsx` | Lesson list with time-gating, progress tracking |
| `StaffSalesLesson.tsx` | Lesson detail with video, content, quiz submission |

**Key Features:**
- Time-gating: Lessons unlock Mon/Wed/Fri based on business days since start
- Program must be "active" and start_date must have passed
- Supports YouTube, Vimeo, Loom video embeds
- Quiz submission with AI feedback display

---

### 7. Admin Pages
**Directory:** `src/pages/admin/`

| File | Purpose |
|------|---------|
| `AdminSalesExperience.tsx` | Main admin page with tabs |
| `sales-experience-tabs/SEAssignmentsTab.tsx` | Assign agencies, manage status, **validates Monday start date** |
| `sales-experience-tabs/SEContentTab.tsx` | Edit lessons with **Rich Text Editor**, video, quizzes |
| `sales-experience-tabs/SEMessagesTab.tsx` | Send messages to all participants |
| `sales-experience-tabs/SEAnalyticsTab.tsx` | View participation analytics |

**Admin Route:** `/admin/sales-experience`
**Admin Sidebar:** Added "Sales Experience" with GraduationCap icon

---

### 8. Rich Text Editor
**File:** `src/components/ui/rich-text-editor.tsx`

**Dependencies Added:**
- `@tiptap/react`
- `@tiptap/starter-kit`
- `@tiptap/extension-link`
- `@tiptap/extension-placeholder`

**Features:**
- Bold, Italic
- Headings (H2, H3)
- Bullet & numbered lists
- Links
- Undo/Redo

**Styles:** Added TipTap styles in `src/index.css` (lines ~255-290)

---

### 9. Routes
**File:** `src/App.tsx`

**Routes Added:**
```
/sales-experience                      → SalesExperienceOverview
/sales-experience/week/:week           → SalesExperienceWeek
/sales-experience/week/:week/documents → SalesExperienceDocuments
/sales-experience/week/:week/transcript→ SalesExperienceTranscript
/sales-experience/messages             → SalesExperienceMessages
/sales-experience/team-progress        → SalesExperienceTeamProgress
/staff/sales-training                  → StaffSalesTraining
/staff/sales-training/lesson/:id       → StaffSalesLesson
/admin/sales-experience                → AdminSalesExperience
```

---

## Configuration Files Updated

| File | Change |
|------|--------|
| `supabase/config.toml` | Added all 6 edge functions with verify_jwt settings |
| `package.json` | Added TipTap dependencies |

---

## Key Design Decisions

### 1. Time-Gating Logic
- Program must be `status: 'active'` (not just 'pending')
- Start date must be a **Monday** (validated in admin form)
- Today must be >= start_date for any lessons to unlock
- Staff lessons unlock: Mon (day_of_week=1), Wed (day_of_week=3), Fri (day_of_week=5)
- Business day calculation excludes weekends

### 2. Authentication Patterns
- **Owners/Managers:** JWT Bearer token via `Authorization` header
- **Staff:** Session token via `x-staff-session` header
- `complete-sales-lesson` supports both patterns

### 3. Video Platform Support
YouTube, Vimeo, and Loom all supported with auto URL conversion:
- YouTube: `youtu.be/xxx` or `watch?v=xxx` → embed
- Vimeo: Uses URL as-is (paste embed URL)
- Loom: `loom.com/share/xxx` → embed

### 4. AI Integration
- Uses `ANTHROPIC_API_KEY` environment variable
- Claude 3 Haiku for quiz feedback and transcript summaries
- Graceful fallback to template text if API key missing

---

## What Remains (Not Implemented)

### 1. Email Sending Cron Job
Emails are **queued** in `sales_experience_email_queue` but not sent.

**Needs:**
- Edge function with pg_cron or external scheduler
- Email service integration (Resend, SendGrid, etc.)
- Process queue and send emails

### 2. Additional Admin Pages
- `AdminSalesExperiencePrompts.tsx` - Edit AI prompts
- `AdminSalesExperienceTemplates.tsx` - Edit email templates

### 3. Owner Lesson Progress Tracking
- `SalesExperienceWeek.tsx` shows lessons but doesn't track owner completion
- Could wire up `complete-sales-lesson` for owner tracking

### 4. Reusable Components
**Directory:** `src/components/sales-experience/` (not created)

Consider extracting:
- Week timeline visualization
- Lesson card component
- Quiz component
- Progress indicators

---

## Files Created/Modified Summary

### Created (27 files)
```
supabase/migrations/20260202060000_sales_experience_tables.sql
supabase/migrations/20260202070000_fix_se_admin_rls.sql
supabase/functions/get-sales-experience/index.ts
supabase/functions/get-staff-sales-lessons/index.ts
supabase/functions/submit-sales-quiz/index.ts
supabase/functions/complete-sales-lesson/index.ts
supabase/functions/sales-experience-messages/index.ts
supabase/functions/upload-sales-transcript/index.ts
src/hooks/useSalesExperienceAccess.ts
src/pages/sales-experience/index.ts
src/pages/sales-experience/SalesExperienceOverview.tsx
src/pages/sales-experience/SalesExperienceWeek.tsx
src/pages/sales-experience/SalesExperienceDocuments.tsx
src/pages/sales-experience/SalesExperienceTranscript.tsx
src/pages/sales-experience/SalesExperienceMessages.tsx
src/pages/sales-experience/SalesExperienceTeamProgress.tsx
src/pages/staff/StaffSalesTraining.tsx
src/pages/staff/StaffSalesLesson.tsx
src/pages/admin/AdminSalesExperience.tsx
src/pages/admin/sales-experience-tabs/SEAssignmentsTab.tsx
src/pages/admin/sales-experience-tabs/SEContentTab.tsx
src/pages/admin/sales-experience-tabs/SEMessagesTab.tsx
src/pages/admin/sales-experience-tabs/SEAnalyticsTab.tsx
src/components/ui/rich-text-editor.tsx
```

### Modified (7 files)
```
src/config/navigation.ts
src/hooks/useSidebarAccess.ts
src/components/AppSidebar.tsx
src/App.tsx
src/index.css
supabase/config.toml
package.json
```

---

## Testing Checklist

### Admin Flow
1. ✅ Login as admin
2. ✅ Go to `/admin/sales-experience`
3. ✅ Create assignment (select agency, pick Monday date, click Start)
4. ✅ Edit lesson content with rich text editor
5. ✅ Add video URL and select platform
6. ✅ Add quiz questions

### Owner Flow
1. ✅ Login as agency owner
2. ✅ See "8-Week Experience" folder in sidebar (if assigned)
3. ✅ View overview, week details
4. ✅ Click Watch/View to open lesson modal with video
5. ✅ Send/receive coach messages

### Staff Flow
1. ✅ Go to `/staff/sales-training` as logged-in staff
2. ✅ See lessons with time-gating (locked/available based on date)
3. ✅ Click into unlocked lesson
4. ✅ Watch video, read content
5. ✅ Submit quiz and see AI feedback
6. ✅ See completion status

---

## Environment Variables Required

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
ANTHROPIC_API_KEY=xxx  # For AI feedback (optional, has fallback)
```

---

## Deployment Commands

```bash
# Push database migrations
supabase db push

# Deploy all edge functions
supabase functions deploy get-sales-experience
supabase functions deploy get-staff-sales-lessons --no-verify-jwt
supabase functions deploy submit-sales-quiz --no-verify-jwt
supabase functions deploy complete-sales-lesson --no-verify-jwt
supabase functions deploy sales-experience-messages
supabase functions deploy upload-sales-transcript
```

---

*Last Updated: 2026-02-02*

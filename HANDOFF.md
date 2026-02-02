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
| `process-sales-experience-emails/index.ts` | None (cron) | Process email queue with Resend API |

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
- `src/components/AppSidebar.tsx` - Added hook import, filter options, admin sidebar item, **unread message badges**
- `src/components/sidebar/SidebarFolder.tsx` - Added optional `badge` prop support

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
| `AdminSalesExperience.tsx` | Main admin page with **7 tabs**, **unread badge on Messages tab** |
| `sales-experience-tabs/SEAssignmentsTab.tsx` | Assign agencies, **"Start in Arrears" support**, validates Monday |
| `sales-experience-tabs/SEContentTab.tsx` | Edit lessons with **Rich Text Editor**, video, quizzes |
| `sales-experience-tabs/SETranscriptsTab.tsx` | **Upload Zoom transcripts** by week, view AI summaries & action items |
| `sales-experience-tabs/SEMessagesTab.tsx` | Send messages to participants, **shows unread count badge** |
| `sales-experience-tabs/SEPromptsTab.tsx` | Edit AI prompts for transcript/quiz processing |
| `sales-experience-tabs/SETemplatesTab.tsx` | Edit email templates with live preview |
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

### 10. "Start in Arrears" Feature ✅ NEW
**File:** `src/pages/admin/sales-experience-tabs/SEAssignmentsTab.tsx`

Allows admins to backdate enrollment start dates for agencies that are already partway through training in another system.

**How it works:**
- Removed `min` date restriction - can now select any Monday (past or future)
- Added `getStartingWeekInfo()` function that calculates:
  - Which week/day the participant will start at based on business days elapsed
  - Whether this is an "arrears" (past date) enrollment
- Shows preview UI when selecting a date:
  - **Future dates:** "Starting Fresh - Week 1, Day 1"
  - **Past dates:** "Starting in Arrears - Week X, Day Y (Z business days in)"
- Auto-activates assignment if start date is in the past (no need to manually click "Start")
- All prior content is immediately unlocked for catch-up

**Example:** If someone started January 20th and today is February 2nd:
- Select January 20th as start date
- UI shows "Week 2, Day 4 (9 business days in)"
- Assignment is auto-activated
- Week 1 + Week 2 Mon/Wed content is unlocked

---

### 11. Unread Message Notification Badges ✅ NEW
**New Hook:** `src/hooks/useSalesExperienceUnread.ts`

| Hook | For | Counts |
|------|-----|--------|
| `useSalesExperienceUnreadMessages()` | Owners/Managers | Unread messages from coach |
| `useSalesExperienceAdminUnreadMessages()` | Admins | Unread messages from owners |

**Where badges appear:**

| Location | File | Shows |
|----------|------|-------|
| Owner sidebar - "8-Week Experience" folder | `AppSidebar.tsx` | Unread coach messages |
| Owner sidebar - "Coach Messages" item | `AppSidebar.tsx` | Unread coach messages |
| Admin - "Messages" tab trigger | `AdminSalesExperience.tsx` | Unread owner messages |
| Admin Messages tab header | `SEMessagesTab.tsx` | "X unread" badge |

**Features:**
- Red destructive variant badges
- Auto-refresh every 30 seconds
- Disappear when count is 0
- "99+" for counts over 99

---

### 12. Reusable Components ✅ COMPLETED
**Directory:** `src/components/sales-experience/`

Extracted shared components:
- `constants.ts` - pillarColors, pillarLabels, dayLabels, types (Pillar, LessonStatus)
- `VideoEmbed.tsx` - YouTube/Vimeo/Loom embed with URL auto-conversion
- `WeekCard.tsx` - Week timeline card with status icons
- `LessonCard.tsx` - Lesson display with progress indicators
- `ProgressStats.tsx` - Stats cards for progress display
- `index.ts` - Barrel exports

---

## Configuration Files Updated

| File | Change |
|------|--------|
| `supabase/config.toml` | Added all 7 edge functions with verify_jwt settings |
| `package.json` | Added TipTap dependencies |

---

## Key Design Decisions

### 1. Time-Gating Logic
- Program must be `status: 'active'` (not just 'pending')
- Start date must be a **Monday** (validated in admin form)
- Today must be >= start_date for any lessons to unlock
- Staff lessons unlock: Mon (day_of_week=1), Wed (day_of_week=3), Fri (day_of_week=5)
- Business day calculation excludes weekends
- **Arrears mode:** Past start dates auto-calculate current week and unlock all prior content

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

## Files Created/Modified Summary

### Created (55 files)
```
supabase/migrations/20260202060000_sales_experience_tables.sql
supabase/migrations/20260202070000_fix_se_admin_rls.sql
supabase/migrations/20260202080000_sales_experience_deliverables.sql       # NEW - Deliverables
supabase/functions/get-sales-experience/index.ts
supabase/functions/get-staff-sales-lessons/index.ts
supabase/functions/submit-sales-quiz/index.ts
supabase/functions/complete-sales-lesson/index.ts
supabase/functions/sales-experience-messages/index.ts
supabase/functions/upload-sales-transcript/index.ts
supabase/functions/process-sales-experience-emails/index.ts
supabase/functions/deliverable-builder-chat/index.ts                       # NEW - Deliverables
supabase/functions/save-deliverable-content/index.ts                       # NEW - Deliverables
supabase/functions/generate-deliverables-pdf/index.ts                      # NEW - Deliverables
src/hooks/useSalesExperienceAccess.ts
src/hooks/useSalesExperienceUnread.ts
src/hooks/useSalesExperienceDeliverables.ts                                # NEW - Deliverables
src/hooks/useDeliverableBuilder.ts                                         # NEW - Deliverables
src/pages/sales-experience/index.ts
src/pages/sales-experience/SalesExperienceOverview.tsx
src/pages/sales-experience/SalesExperienceWeek.tsx
src/pages/sales-experience/SalesExperienceDocuments.tsx
src/pages/sales-experience/SalesExperienceTranscript.tsx
src/pages/sales-experience/SalesExperienceMessages.tsx
src/pages/sales-experience/SalesExperienceTeamProgress.tsx
src/pages/sales-experience/SalesExperienceDeliverables.tsx                 # NEW - Deliverables
src/pages/sales-experience/SalesExperienceDeliverableBuilder.tsx           # NEW - Deliverables
src/pages/sales-experience/SalesExperienceDeliverableEdit.tsx              # NEW - Deliverables
src/pages/staff/StaffSalesTraining.tsx
src/pages/staff/StaffSalesLesson.tsx
src/pages/admin/AdminSalesExperience.tsx
src/pages/admin/sales-experience-tabs/SEAssignmentsTab.tsx
src/pages/admin/sales-experience-tabs/SEContentTab.tsx
src/pages/admin/sales-experience-tabs/SETranscriptsTab.tsx
src/pages/admin/sales-experience-tabs/SEMessagesTab.tsx
src/pages/admin/sales-experience-tabs/SEAnalyticsTab.tsx
src/pages/admin/sales-experience-tabs/SEPromptsTab.tsx
src/pages/admin/sales-experience-tabs/SETemplatesTab.tsx
src/components/ui/rich-text-editor.tsx
src/components/sales-experience/index.ts
src/components/sales-experience/constants.ts
src/components/sales-experience/VideoEmbed.tsx
src/components/sales-experience/WeekCard.tsx
src/components/sales-experience/LessonCard.tsx
src/components/sales-experience/ProgressStats.tsx
src/components/sales-experience/deliverables/index.ts                      # NEW - Deliverables
src/components/sales-experience/deliverables/DeliverableCard.tsx           # NEW - Deliverables
src/components/sales-experience/deliverables/SalesProcessEditor.tsx        # NEW - Deliverables
src/components/sales-experience/deliverables/AccountabilityEditor.tsx      # NEW - Deliverables
src/components/sales-experience/deliverables/ConsequenceLadderEditor.tsx   # NEW - Deliverables
src/components/sales-experience/deliverables/DeliverableBuilderChat.tsx    # NEW - Deliverables
src/components/sales-experience/deliverables/DeliverablesPDFDialog.tsx     # NEW - Deliverables
```

### Modified (10 files)
```
src/config/navigation.ts                                      # Added deliverables nav item
src/hooks/useSidebarAccess.ts
src/components/AppSidebar.tsx
src/components/sidebar/SidebarFolder.tsx
src/App.tsx                                                   # Added deliverables routes
src/index.css
supabase/config.toml                                          # Added 3 deliverable functions
package.json
src/pages/sales-experience/index.ts                           # Added deliverable exports
src/pages/admin/sales-experience-tabs/SEPromptsTab.tsx        # Updated description
```

---

## What Remains (Not Yet Implemented)

### 1. Email Template: `coach_message`
The template exists in the database but the messaging function doesn't queue emails when coach sends messages. User decided this is **not needed** - notification badges are sufficient.

### 2. Potential Future Enhancements
- Real-time message notifications (WebSocket/Supabase Realtime)
- Mark messages as read when viewing (partially implemented for owners)
- Quiz attempt history view for admins
- Export analytics to CSV

---

## Testing Checklist

### Admin Flow
1. ✅ Login as admin
2. ✅ Go to `/admin/sales-experience`
3. ✅ Create assignment (select agency, pick Monday date - past or future)
4. ✅ See "Starting in Arrears" preview for past dates
5. ✅ Edit lesson content with rich text editor
6. ✅ Add video URL and select platform
7. ✅ Add quiz questions
8. ✅ See unread message badge on Messages tab

### Owner Flow
1. ✅ Login as agency owner
2. ✅ See "8-Week Experience" folder in sidebar with unread badge (if messages)
3. ✅ View overview, week details
4. ✅ Click Watch/View to open lesson modal with video
5. ✅ Send/receive coach messages
6. ✅ See Coach Messages item with unread badge

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
RESEND_API_KEY=xxx     # For email sending (optional)
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
supabase functions deploy process-sales-experience-emails --no-verify-jwt

# Deliverables functions (NEW)
supabase functions deploy deliverable-builder-chat
supabase functions deploy save-deliverable-content
supabase functions deploy generate-deliverables-pdf
```

---

---

## 13. Deliverables Feature ✅ NEW (2026-02-02)

Three key documents that agency owners build throughout the 8-Week program and receive as a professional branded PDF at the end.

### Deliverable Types
1. **Sales Process** - Rapport → Coverage → Closing framework with bullet points
2. **Accountability Metrics** - User-defined categories with metrics
3. **Consequence Ladder** - Progressive steps (1st incident → 2nd → 3rd...)

### Database Migration
**File:** `supabase/migrations/20260202080000_sales_experience_deliverables.sql`

**Tables:**
- `sales_experience_deliverables` - One row per deliverable type per assignment
  - Columns: `id`, `assignment_id`, `deliverable_type`, `status`, `content_json`, timestamps
  - Status values: `draft`, `in_progress`, `complete`
- `sales_experience_deliverable_sessions` - AI Builder conversation history
  - Columns: `id`, `deliverable_id`, `user_id`, `messages_json`, `generated_content_json`, `status`, timestamps

**Auto-creation trigger:** When assignment becomes active/pending, auto-creates 3 deliverables with empty content.

**AI Prompts seeded:** `deliverable_sales_process`, `deliverable_accountability_metrics`, `deliverable_consequence_ladder`

### Content JSON Structures
```typescript
// Sales Process
{ "rapport": ["item1", "item2"], "coverage": ["item1"], "closing": ["item1"] }

// Accountability Metrics
{ "categories": [{ "name": "Category Name", "items": ["metric1", "metric2"] }] }

// Consequence Ladder
{ "steps": [{ "incident": 1, "title": "Step Title", "description": "..." }] }
```

### Edge Functions
**Directory:** `supabase/functions/`

| Function | Actions | Purpose |
|----------|---------|---------|
| `deliverable-builder-chat` | start, get_session, message, apply | AI-guided Q&A conversation |
| `save-deliverable-content` | list, save | Manual edits and list deliverables |
| `generate-deliverables-pdf` | generate | Returns branded HTML for PDF |

**Key AI Pattern:** AI prompts instruct Claude to output JSON in \`\`\`json blocks when user is ready. The `extractJsonFromResponse()` function parses these.

### React Hooks
**Directory:** `src/hooks/`

| Hook | Purpose |
|------|---------|
| `useSalesExperienceDeliverables.ts` | Fetches deliverables, save mutations, progress calculations |
| `useDeliverableBuilder.ts` | Manages AI builder conversation state |

**Exported from `useSalesExperienceDeliverables.ts`:**
- Types: `DeliverableType`, `DeliverableStatus`, `Deliverable`, `DeliverableSession`
- Content types: `SalesProcessContent`, `AccountabilityMetricsContent`, `ConsequenceLadderContent`
- Hooks: `useSalesExperienceDeliverables()`, `useSaveDeliverableContent()`, `useGenerateDeliverablesPdf()`
- Helpers: `getDeliverableProgress()`, `getOverallProgress()`, `deliverableInfo`

### Components
**Directory:** `src/components/sales-experience/deliverables/`

| Component | Purpose |
|-----------|---------|
| `DeliverableCard.tsx` | Visual card with status badge, progress, action buttons |
| `SalesProcessEditor.tsx` | 3-column layout with drag-drop (@dnd-kit) |
| `AccountabilityEditor.tsx` | Dynamic categories with nested items, drag-drop |
| `ConsequenceLadderEditor.tsx` | Progressive steps editor with drag-drop |
| `DeliverableBuilderChat.tsx` | AI chat interface with JSON preview |
| `DeliverablesPDFDialog.tsx` | Dialog with iframe preview, print/download |
| `index.ts` | Barrel exports |

### Pages
**Directory:** `src/pages/sales-experience/`

| File | Route | Purpose |
|------|-------|---------|
| `SalesExperienceDeliverables.tsx` | `/sales-experience/deliverables` | Dashboard with 3 cards |
| `SalesExperienceDeliverableBuilder.tsx` | `/sales-experience/deliverables/:type` | AI builder |
| `SalesExperienceDeliverableEdit.tsx` | `/sales-experience/deliverables/:type/edit` | Direct editor |

### Integration Points

| File | Change |
|------|--------|
| `src/App.tsx` | Added imports and 3 routes |
| `src/pages/sales-experience/index.ts` | Added exports |
| `src/pages/sales-experience/SalesExperienceOverview.tsx` | Added "Your Deliverables" card section |
| `src/config/navigation.ts` | Added "Your Deliverables" nav item |
| `src/pages/admin/sales-experience-tabs/SEPromptsTab.tsx` | Updated description |
| `supabase/config.toml` | Added 3 edge functions |

### Files Created
```
supabase/migrations/20260202080000_sales_experience_deliverables.sql
supabase/functions/deliverable-builder-chat/index.ts
supabase/functions/save-deliverable-content/index.ts
supabase/functions/generate-deliverables-pdf/index.ts
src/hooks/useSalesExperienceDeliverables.ts
src/hooks/useDeliverableBuilder.ts
src/components/sales-experience/deliverables/DeliverableCard.tsx
src/components/sales-experience/deliverables/SalesProcessEditor.tsx
src/components/sales-experience/deliverables/AccountabilityEditor.tsx
src/components/sales-experience/deliverables/ConsequenceLadderEditor.tsx
src/components/sales-experience/deliverables/DeliverableBuilderChat.tsx
src/components/sales-experience/deliverables/DeliverablesPDFDialog.tsx
src/components/sales-experience/deliverables/index.ts
src/pages/sales-experience/SalesExperienceDeliverables.tsx
src/pages/sales-experience/SalesExperienceDeliverableBuilder.tsx
src/pages/sales-experience/SalesExperienceDeliverableEdit.tsx
```

### Known Limitations
1. **PDF is HTML-based** - Uses browser print dialog. No server-side PDF library.
2. **AI must include JSON block** - If AI doesn't output ```json, user must continue conversation.
3. **No version history** - Content is overwritten on save.

### Testing Checklist for Deliverables
1. [ ] Apply migration: `supabase db push`
2. [ ] Deploy functions: `supabase functions deploy deliverable-builder-chat save-deliverable-content generate-deliverables-pdf`
3. [ ] Create/activate assignment in Admin
4. [ ] Verify 3 deliverables auto-created
5. [ ] Test AI builder for each type (Sales Process, Accountability, Consequence Ladder)
6. [ ] Test direct editor with drag-drop
7. [ ] Test "Mark Complete" validation
8. [ ] Test PDF generation and print
9. [ ] Verify admin can see/edit prompts in SEPromptsTab

### Next Steps to Continue
1. **Deploy:** Apply migration and deploy edge functions
2. **Test:** Full end-to-end testing of deliverables flow
3. **Optional enhancements:**
   - Add deliverables data to `get-sales-experience` response
   - Add deliverable progress to admin analytics
   - Server-side PDF generation with jsPDF

---

*Last Updated: 2026-02-02 (Added: Deliverables feature with AI builder, direct editors, PDF generation)*



## Plan: Add HelpButton to Sequence Builder and Sequence Queue pages

**What**: Add the existing `HelpButton` component (linked to the `"Sequence Builder & Queue"` video key from `help_videos`) to three pages:

1. **Sequence Builder** (`src/pages/agency/SequenceBuilder.tsx`) — in the header next to the title
2. **Agency Sequence Queue** (`src/pages/agency/OnboardingTasks.tsx`) — in the header next to the title
3. **Staff Sequence Queue** (`src/pages/staff/StaffOnboardingTasks.tsx`) — in the header next to the title

**How**:
- Import `HelpButton` from `@/components/HelpButton` in each file
- Add `<HelpButton videoKey="Sequence Builder & Queue" />` next to each page's `<h1>` title element
- Place it inside the existing `flex items-center gap-3` div so it sits inline with the title and icon

**Technical details**:
- Video key: `"Sequence Builder & Queue"` (confirmed from database)
- The `HelpButton` auto-hides if no active content exists, so no conditional logic needed


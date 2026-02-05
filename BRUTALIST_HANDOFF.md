# Handoff: Neo-Brutalist App UI Redesign (Part 3)

## Project Context

We're redesigning AgencyBrain's in-app UI to use a Neo-Brutalist design system. We've built working prototypes and the user likes the direction.

---

## What's Been Built

### Brutalist Pages (All Working)

1. **Brutalist Dashboard** (`/brutalist-dashboard`)
   - File: `src/pages/BrutalistDashboardPage.tsx`
   - Component: `src/components/brutalist/BrutalistDashboard.tsx`

2. **Brutalist Sequence Queue** (`/brutalist-sequence-queue`)
   - File: `src/pages/BrutalistSequenceQueuePage.tsx`

3. **Brutalist LQS Roadmap** (`/brutalist-lqs`)
   - File: `src/pages/BrutalistLQSRoadmapPage.tsx`
   - Features: Sales funnel visualization, clickable buckets, expandable household rows

4. **Brutalist Annual Bonus Tool** (`/brutalist-bonus`)
   - File: `src/pages/BrutalistAnnualBonusPage.tsx`
   - Features: KPI strip, drag-and-drop file upload, collapsible form sections, growth grid

5. **Brutalist ROI Analytics** (`/brutalist-roi`) ✨ NEW
   - File: `src/pages/BrutalistROIPage.tsx`
   - Features: Conversion funnel, ROI bubble chart, sortable lead source table, top performers panel

6. **Brutalist Scorecards** (`/brutalist-scorecards`) ✨ NEW
   - File: `src/pages/BrutalistScorecardsPage.tsx`
   - Features: Team performance rings grid, historical ring views, streak leaders, trend charts

7. **Brutalist Renewals** (`/brutalist-renewals`) ✨ NEW
   - File: `src/pages/BrutalistRenewalsPage.tsx`
   - Features: **Recharts area/bar charts**, clickable chart filtering, status tabs, priority toggles, expandable rows

### Shared Components

- **BrutalistSidebar**: `src/components/brutalist/BrutalistSidebar.tsx`
- **Component Index**: `src/components/brutalist/index.ts`

---

## Design System Established

### Colors (Brand-Consistent)
```
Background: #1A1A2E (solid dark blue for all cards/boxes - blocks grid pattern)
Grid pattern on page background only (brutalist-app-bg class)
Red: #FF5252 - overdue/missed/danger
Green: #4CAF50 - success/done/primary actions
Yellow: var(--brutalist-yellow) - today, highlights, accents
Amber: var(--brutalist-amber) - warnings, secondary highlights
Cyan: var(--brutalist-cyan) - info, tertiary accents
White: #FFFFFF - upcoming, neutral states, borders
```

### Visual Rules
- 2px thick white borders (brutalist style)
- No rounded corners (sharp, geometric)
- Bold uppercase typography with letter-spacing
- Font: Space Grotesk (`font-brutalist` class)
- Cards use solid `#1A1A2E` background (NOT `var(--brutalist-surface)`)
- Dashed borders for dropzones, solid on hover
- Square dots on charts instead of circles

### CSS Classes (in `src/index.css`)
- `.brutalist-app` - dark mode variables
- `.brutalist-app-light` - light mode variables
- `.brutalist-app-bg` - grid pattern background
- `.font-brutalist` - Space Grotesk font

### Chart Styling (Recharts)
- Use `type="monotone"` for smooth curves
- Yellow gradient fill: `var(--brutalist-yellow)` → transparent
- Square markers using `<rect>` instead of `<circle>`
- Grid lines: `rgba(255,255,255,0.1)`
- Axis text: `rgba(255,255,255,0.5)`, Space Grotesk font
- Tooltips: `#1A1A2E` bg with 2px white border

---

## Key Files to Reference

- **Routes**: `src/App.tsx` (lines 76-82 for imports, ~253-295 for route definitions)
- **Component index**: `src/components/brutalist/index.ts`
- **Existing brutalist pages**: `src/pages/Brutalist*.tsx`
- **Original pages for reference**:
  - `src/pages/LqsRoiPage.tsx` (ROI Analytics)
  - `src/pages/Renewals.tsx` (Renewals)
  - `src/components/renewals/RenewalsDashboard.tsx` (Chart patterns)

---

## Important Learnings

1. **Don't use light cyan/teal** (`#38BDF8` or `#26A69A`) - throws off brand feel
2. **Use solid `#1A1A2E`** for card backgrounds, NOT `var(--brutalist-surface)`
3. **Keep grid pattern only on page background** - cards should block it
4. **Match dropdown styling** (solid dark blue) for consistency
5. **Remove tier access checks** for mockup pages (these are prototypes)
6. **Charts work well** with the brutalist aesthetic - use square dots, yellow gradients
7. **Interactive charts** - clicking filters the data table below

---

## Potential Next Steps

1. **More pages to brutalist-ify**:
   - Cancel Audit (`src/pages/CancelAudit.tsx`)
   - Contacts (`src/pages/Contacts.tsx`)
   - Sales Dashboard (`src/pages/Sales.tsx`)
   - Winback HQ (`src/pages/WinbackHQ.tsx`)

2. **Enhancements**:
   - Add light mode toggle (variables exist in CSS)
   - Connect pages to real data hooks (currently using mock data)
   - Add more chart types (pie charts, sparklines)
   - Mobile responsive refinements

3. **Component extraction**:
   - Extract common patterns into reusable brutalist components
   - Create a brutalist button component
   - Create a brutalist table component
   - Create a brutalist chart wrapper

---

## Running the Project

```bash
npm run dev          # Start dev server (localhost:8080)
npm run build        # Production build
```

Then visit:
- http://localhost:8080/brutalist-dashboard
- http://localhost:8080/brutalist-sequence-queue
- http://localhost:8080/brutalist-lqs
- http://localhost:8080/brutalist-bonus
- http://localhost:8080/brutalist-roi
- http://localhost:8080/brutalist-scorecards
- http://localhost:8080/brutalist-renewals

---

Copy this into your new context window and tell Claude to continue with whatever you'd like to work on next.

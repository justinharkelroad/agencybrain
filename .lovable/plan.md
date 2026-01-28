# Meeting Frame KPI Fix - COMPLETED

Role-based KPI filtering implemented to ensure consistent display.

## Changes Made

1. **Edge Function** (`supabase/functions/scorecards_admin/index.ts`):
   - `meeting_frame_list`: Now returns `scorecardRules` with role → selected_metrics mapping
   - `meeting_frame_generate`: Returns `roleMetrics` and `memberRole` for the selected team member

2. **Frontend** (`src/components/agency/MeetingFrameTab.tsx`):
   - Added `scorecardRules` state to store role → metrics mapping
   - Staff mode: Populates rules from edge function response
   - Owner mode: Fetches rules directly from `scorecard_rules` table
   - `generateReport()`: Filters KPIs by member's role before aggregation
   - Removed non-zero filtering for consistent display

## Result

- **Service member** → Shows exactly 5 configured circles
- **Sales member** → Shows exactly 5 configured circles  
- **Hybrid/Manager** → Shows combined metrics from both roles
- Zeros display when no data exists (consistent, predictable UI)

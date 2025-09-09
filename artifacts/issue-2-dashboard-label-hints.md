# Issue 2 - Dashboard Label Updating After KPI Rename

## Option A Selected: Add Inline Hints

**Implementation**: Keep current "latest wins per day" rule and add user-friendly hints explaining when renamed KPIs will reflect in the dashboard.

## Artifact: UI Text Added Locations (Diff)

### Location 1: Metric Tiles Section

**File**: `src/pages/MetricsDashboard.tsx`  
**Lines**: 271-279

```diff
        {/* Tiles - Dynamic based on role */}
+       <div className="space-y-2">
+         <div className="flex items-center gap-2 text-xs text-muted-foreground">
+           <span>📊 Metric labels reflect the names used in the last submission</span>
+           <span>•</span>
+           <span>Renamed KPIs will update after next form submission</span>
+         </div>
+       </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
```

### Location 2: Performance Table Section

**File**: `src/pages/MetricsDashboard.tsx`  
**Lines**: 300-306

```diff
        {/* Table */}
        <Card className="glass-surface">
          <CardHeader>
            <CardTitle className="text-lg">Team Member Performance</CardTitle>
+           <p className="text-xs text-muted-foreground mt-1">
+             Column names reflect KPI labels from most recent submissions • Renamed KPIs update after next submission
+           </p>
          </CardHeader>
```

## User Experience Impact

### Before (Confusing)
- User renames "Sold Items" to "Policies Written" in KPI management
- Dashboard still shows "Sold Items"  
- No explanation why change didn't take effect
- User assumes system is broken

### After (Clear)
- Dashboard shows helpful hint: "📊 Metric labels reflect the names used in the last submission • Renamed KPIs will update after next form submission"
- Table shows: "Column names reflect KPI labels from most recent submissions • Renamed KPIs update after next submission"
- User understands they need to submit a form to see the updated labels
- Clear expectation set about when changes will appear

## Technical Details

**Label Resolution Logic** (unchanged):
1. Dashboard uses `getKpiLabel()` function
2. Creates `labelMap` from `dashboardData.metrics`
3. Uses `label_at_submit` field from most recent submissions
4. Falls back to KPI slug if no submission data exists

**Hint Placement Strategy**:
- **Metric Tiles**: Hint appears above tiles with emoji for visual appeal
- **Performance Table**: Hint in card header as subtle description text
- **Styling**: Uses `text-muted-foreground` for non-intrusive appearance
- **Language**: Clear, actionable explanation of current behavior

## Issue 2 Status: ✅ RESOLVED

The dashboard now clearly communicates to users when renamed KPIs will reflect, eliminating confusion about the "latest wins per day" behavior while maintaining system consistency.

**Ready for Issue 3: Typing glitch fixes**

# Fix Call Scoring Empty Feedback Bug

## Problem Summary
The Skill Breakdown section shows scores but no feedback text. Investigation revealed two misalignments between the edge function output and the UI rendering logic.

## Root Cause

### Issue 1: Field Name Mismatch
The UI component looks for `.coaching` but the edge function returns `.feedback`:
- Edge function: `section_scores[key].feedback`
- UI expects: `sectionScores[key]?.coaching`

### Issue 2: Structural Disconnect
The edge function requests two separate objects:
- `skill_scores`: Simple key-value pairs (`{closing: 50}`)
- `section_scores`: Detailed objects with feedback

The UI renders `skill_scores` and attempts to pull feedback from `section_scores[key]?.coaching`, which fails because:
1. The field is called `feedback`, not `coaching`
2. The keys might not match exactly (e.g., "Process Discipline" vs "process_discipline")

---

## Solution

Update the UI component to correctly read the feedback from `section_scores[key].feedback`:

### File: `src/components/CallScorecard.tsx`

**Change line 567:**
```typescript
// Before
feedback: (sectionScores as any)?.[key]?.coaching || null,

// After  
feedback: (sectionScores as any)?.[key]?.feedback || null,
```

**Also add the tip field (line 568):**
```typescript
// Before
tip: null

// After
tip: (sectionScores as any)?.[key]?.tip || null
```

---

## Technical Details

**Why this fixes it:**
1. The edge function already returns the correct STRENGTHS/GAPS/ACTION format in `section_scores[key].feedback`
2. The UI already has rendering logic for feedback (lines 687-688) and tips (lines 690-691)
3. We just need to correctly map the data during the object-to-array conversion

**No edge function changes needed** - the GPT prompt is already correct. This is purely a frontend field mapping issue.

---

## Testing Recommendation

After this fix:
1. Process a new call through the system (or re-score an existing one)
2. Verify the SKILL BREAKDOWN cards show the full STRENGTHS/GAPS/ACTION text
3. Verify the green tip icon appears with coaching takeaways

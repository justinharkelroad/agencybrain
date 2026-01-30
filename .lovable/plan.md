
# Fix Call Scoring Empty Feedback Bug - COMPLETED

## Problem Summary
The Skill Breakdown section showed scores but no feedback text due to:
1. **Array bypass**: UI returned array-format `skill_scores` as-is without enrichment
2. **Field name mismatch**: Backend looked for `.coaching` but GPT returns `.feedback`
3. **Missing enrichment**: Array-format skill_scores weren't enriched with section_scores data

## Solution Implemented

### Phase 1: Frontend Fix (CallScorecard.tsx) ✅
- Added `normalizeKey()` helper to convert display names to snake_case keys
- Built `sectionScoresMap` that handles both object and array formats
- Updated `skillScoresArray` builder to ALWAYS enrich entries with feedback/tip from section_scores
- Works for both array and object formats of skill_scores

### Phase 2: Backend Fix (analyze-call/index.ts) ✅
- Added `normalizeKey()` helper for consistent key matching
- Built `sectionScoresMap` for reliable lookup
- Fixed object→array conversion to use `.feedback` (with `.coaching` fallback)
- Added enrichment for when skill_scores is already an array
- Added `skill_scores` generation for service calls (UI consistency)

## Files Changed
- `src/components/CallScorecard.tsx` - Frontend enrichment
- `supabase/functions/analyze-call/index.ts` - Backend storage fix

## Testing
1. Existing calls: Frontend will now pull feedback from section_scores at render time
2. New calls: Backend will store feedback/tip directly in skill_scores array

No database migration needed. No re-analysis required for existing calls.

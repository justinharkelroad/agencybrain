
# Fix Empty Sales Call Skill Sections (RAPPORT / COVERAGE / CLOSING)

## Problem

The Sales Call Report Card is showing empty RAPPORT, COVERAGE, and CLOSING sections because:

1. The code detects `section_scores.rapport`, `section_scores.coverage`, `section_scores.closing` exist in the database
2. This triggers `hasLegacySections = true`, which renders the **legacy format**
3. The legacy format expects `wins[]`, `failures[]`, and `coaching` properties
4. But the **new global sales template** outputs `feedback` (with STRENGTHS/GAPS/ACTION markers), `score`, and `tip`
5. Since `wins`, `failures`, `coaching` are undefined, the sections render empty

**Database data structure (new format):**
```json
{
  "rapport": {
    "feedback": "STRENGTHS: Lori confirmed... GAPS: She did not ask... ACTION: Start calls by...",
    "score": 60,
    "tip": "Ask open-ended questions..."
  }
}
```

**Legacy format expected by code:**
```json
{
  "rapport": {
    "wins": ["Win 1", "Win 2"],
    "failures": ["Gap 1"],
    "coaching": "Some coaching text"
  }
}
```

---

## Solution

Update the legacy section rendering (lines 633-731) to handle BOTH formats:
1. If the section has `wins[]`/`failures[]` arrays → render the old way
2. If the section has `feedback` string → parse it with `parseFeedback()` and render with STRENGTHS/GAPS/ACTION icons

### File: `src/components/CallScorecard.tsx`

#### Changes to the legacy section rendering (~lines 633-731)

For each of the three section cards (RAPPORT, COVERAGE, CLOSING):

**Before (lines 644-666 for RAPPORT):**
```tsx
{rapportData?.wins?.map((win: string, i: number) => (
  <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
    <span>{win}</span>
  </p>
))}
{rapportData?.failures?.map((failure: string, i: number) => (
  <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
    <span>{failure}</span>
  </p>
))}
{rapportData?.coaching && (
  <div className="mt-4 pt-3 border-t">
    <p className="text-xs text-muted-foreground mb-1">COACHING</p>
    <p className="text-sm">{rapportData.coaching}</p>
  </div>
)}
```

**After:**
```tsx
{/* Handle both legacy (wins/failures) and new (feedback) formats */}
{rapportData?.wins?.map((win: string, i: number) => (
  <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
    <span>{win}</span>
  </p>
))}
{rapportData?.failures?.map((failure: string, i: number) => (
  <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
    <span>{failure}</span>
  </p>
))}
{rapportData?.coaching && (
  <div className="mt-4 pt-3 border-t">
    <p className="text-xs text-muted-foreground mb-1">COACHING</p>
    <p className="text-sm">{rapportData.coaching}</p>
  </div>
)}
{/* NEW: Handle feedback string format (STRENGTHS/GAPS/ACTION) */}
{rapportData?.feedback && !rapportData?.wins && (() => {
  const parsed = parseFeedback(rapportData.feedback);
  if (parsed.strengths || parsed.gaps || parsed.action) {
    return (
      <div className="space-y-2">
        {parsed.strengths && (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-400">
              <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
            </p>
          </div>
        )}
        {parsed.gaps && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-400">
              <span className="font-semibold">GAPS:</span> {parsed.gaps}
            </p>
          </div>
        )}
        {parsed.action && (
          <div className="flex items-start gap-2">
            <Target className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-400">
              <span className="font-semibold">ACTION:</span> {parsed.action}
            </p>
          </div>
        )}
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">{rapportData.feedback}</p>;
})()}
{rapportData?.tip && (
  <p className="text-xs text-green-400 mt-3">💡 {rapportData.tip}</p>
)}
```

Apply the same pattern to:
- COVERAGE section (lines 669-698)
- CLOSING section (lines 700-729)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/CallScorecard.tsx` | Update legacy section rendering (~lines 633-731) to handle `feedback` string format alongside `wins`/`failures` arrays |

---

## Result

- **New calls** using the global sales template with `feedback` strings will display properly with STRENGTHS/GAPS/ACTION formatting
- **Old calls** with `wins[]`/`failures[]` arrays will continue working as before
- Existing calls will display correctly immediately on refresh (frontend-only change)

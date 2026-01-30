
# Format STRENGTHS/GAPS/ACTION Feedback

## Current State
The feedback text displays as one continuous paragraph:
```
STRENGTHS: Lori systematically gathered information... GAPS: The call lacked a clear structure... ACTION: Practice a more structured approach...
```

## Goal
Parse and visually separate the three coaching sections with proper formatting:
- **STRENGTHS** - green text with checkmark icon
- **GAPS** - red/amber text with alert icon  
- **ACTION** - blue text with arrow/target icon

---

## Implementation

### File: `src/components/CallScorecard.tsx`

**1. Add a helper function to parse the feedback string**

Create a `parseFeedback()` function that extracts STRENGTHS, GAPS, and ACTION from the raw feedback string:

```typescript
function parseFeedback(feedback: string | null): { 
  strengths: string | null; 
  gaps: string | null; 
  action: string | null;
  raw: string | null;
} {
  if (!feedback) return { strengths: null, gaps: null, action: null, raw: null };
  
  // Match patterns like "STRENGTHS: text. GAPS: text. ACTION: text."
  const strengthsMatch = feedback.match(/STRENGTHS?:\s*([^]*?)(?=\s*GAPS?:|$)/i);
  const gapsMatch = feedback.match(/GAPS?:\s*([^]*?)(?=\s*ACTIONS?:|$)/i);
  const actionMatch = feedback.match(/ACTIONS?:\s*([^]*?)(?:\.|$)/i);
  
  return {
    strengths: strengthsMatch?.[1]?.trim() || null,
    gaps: gapsMatch?.[1]?.trim() || null,
    action: actionMatch?.[1]?.trim() || null,
    raw: feedback // Fallback if parsing fails
  };
}
```

**2. Update the feedback rendering (around line 745-747)**

Replace the plain paragraph with structured, color-coded sections:

```tsx
{skill.feedback && (() => {
  const parsed = parseFeedback(skill.feedback);
  // If we got structured data, render it nicely
  if (parsed.strengths || parsed.gaps || parsed.action) {
    return (
      <div className="space-y-2 mt-2">
        {parsed.strengths && (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
            <p className="text-xs text-green-400">
              <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
            </p>
          </div>
        )}
        {parsed.gaps && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-400">
              <span className="font-semibold">GAPS:</span> {parsed.gaps}
            </p>
          </div>
        )}
        {parsed.action && (
          <div className="flex items-start gap-2">
            <Target className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-400">
              <span className="font-semibold">ACTION:</span> {parsed.action}
            </p>
          </div>
        )}
      </div>
    );
  }
  // Fallback: render as-is for legacy data
  return <p className="text-xs text-muted-foreground mb-2">{skill.feedback}</p>;
})()}
```

---

## Visual Result

Each skill card will show:

```text
Process Discipline                    7/10

✓ STRENGTHS: Lori systematically gathered information 
             about the client's current insurance...

⚠ GAPS: The call lacked a clear structure in terms of 
        verification and documentation...

◎ ACTION: Practice a more structured approach to 
          verification and ensure all client 
          information is accurately documented.

💡 Ensure all client information is verified...
```

---

## Technical Notes
- Uses existing Lucide icons already imported (CheckCircle2, AlertTriangle, Target)
- Regex is case-insensitive and handles both "STRENGTH/STRENGTHS" and "GAP/GAPS"
- Falls back to raw text for legacy calls that don't use the new format
- No backend changes required - this is pure presentation logic

---

## Scope
This is a quick frontend enhancement that can be done now without interfering with Phase 3 verification. The data pipeline is already working correctly.

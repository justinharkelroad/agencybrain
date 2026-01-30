
# Fix Service Call Feedback Section Formatting

## Problem
The Service Call Report Card displays STRENGTHS, GAPS, and ACTION feedback as one continuous paragraph instead of separate, color-coded sections with icons.

**Current behavior (ServiceCallReportCard.tsx line 353-355):**
```
STRENGTHS: Jennifer greeted Tony warmly... GAPS: The initial confusion... ACTION: Clarify the customer's request...
```
All rendered as a single muted gray paragraph.

**Expected behavior (matching CallScorecard.tsx):**
- STRENGTHS: Green text with checkmark icon
- GAPS: Amber text with warning icon  
- ACTION: Blue text with target icon

---

## Root Cause
The `ServiceCallReportCard.tsx` component does not use the `parseFeedback()` helper function that exists in `CallScorecard.tsx`. It simply renders `section.feedback` as raw text.

---

## Solution

### 1. Extract `parseFeedback` to a Shared Utility

Create a new shared utility file so both components can use the same parsing logic:

**File: `src/lib/utils/feedback-parser.ts`**

```typescript
// Helper to parse STRENGTHS/GAPS/ACTION from feedback string
export function parseFeedback(feedback: string | null): { 
  strengths: string | null; 
  gaps: string | null; 
  action: string | null;
  raw: string | null;
} {
  if (!feedback) return { strengths: null, gaps: null, action: null, raw: null };
  
  const strengthsMatch = feedback.match(/STRENGTHS?:\s*([\s\S]*?)(?=\s*GAPS?:|$)/i);
  const gapsMatch = feedback.match(/GAPS?:\s*([\s\S]*?)(?=\s*ACTIONS?:|$)/i);
  const actionMatch = feedback.match(/ACTIONS?:\s*([\s\S]*?)$/i);
  
  const cleanText = (text: string | null) => {
    if (!text) return null;
    return text.replace(/\s*$/, '').trim();
  };
  
  return {
    strengths: cleanText(strengthsMatch?.[1]) || null,
    gaps: cleanText(gapsMatch?.[1]) || null,
    action: cleanText(actionMatch?.[1]) || null,
    raw: feedback
  };
}
```

### 2. Update ServiceCallReportCard.tsx

**Import the utility and icons:**
```typescript
import { parseFeedback } from '@/lib/utils/feedback-parser';
import { CheckCircle2, AlertTriangle, Target } from 'lucide-react';
```

**Replace lines 353-355 with structured rendering:**

```typescript
{section.feedback && (() => {
  const parsed = parseFeedback(section.feedback);
  if (parsed.strengths || parsed.gaps || parsed.action) {
    return (
      <div className="space-y-2 mb-2">
        {parsed.strengths && (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
            <p className="text-sm" style={{ color: '#4ade80' }}>
              <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
            </p>
          </div>
        )}
        {parsed.gaps && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
            <p className="text-sm" style={{ color: '#fbbf24' }}>
              <span className="font-semibold">GAPS:</span> {parsed.gaps}
            </p>
          </div>
        )}
        {parsed.action && (
          <div className="flex items-start gap-2">
            <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#3b82f6' }} />
            <p className="text-sm" style={{ color: '#60a5fa' }}>
              <span className="font-semibold">ACTION:</span> {parsed.action}
            </p>
          </div>
        )}
      </div>
    );
  }
  // Fallback for legacy feedback without markers
  return (
    <p className="text-sm mb-2" style={{ color: COLORS.textMuted }}>
      {section.feedback}
    </p>
  );
})()}
```

### 3. Update CallScorecard.tsx to Use Shared Utility

Replace the local `parseFeedback` function with an import:

```typescript
import { parseFeedback } from '@/lib/utils/feedback-parser';
```

Remove lines 24-50 (the local function definition).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/utils/feedback-parser.ts` | **CREATE** - New shared utility |
| `src/components/call-scoring/ServiceCallReportCard.tsx` | Import utility, add icons, update rendering at lines 353-355 |
| `src/components/CallScorecard.tsx` | Import shared utility, remove local function (lines 24-50) |

---

## Result

Both service calls and sales calls will display the coaching feedback in a consistent, structured format:
- Green checkmark with STRENGTHS text
- Amber warning with GAPS text
- Blue target with ACTION text

Existing calls will display correctly immediately on refresh (frontend-only change).

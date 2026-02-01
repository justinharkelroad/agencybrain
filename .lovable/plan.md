
# Complete Plan: Fix Discovery Flow & Show Full Flow on Completion

## Part 1: Flow Template Audit Results

| Flow | Status | Notes |
|------|--------|-------|
| **Grateful** | ✅ OK | Uses `{trigger}` and `{story}` interpolation - both are properly configured as `textarea` type questions with matching `interpolation_key` |
| **Bible** | ✅ OK | Uses conditional `show_if` logic only - no problematic interpolations |
| **Discovery** | ❌ BROKEN | `apply_category` question is misconfigured |

**Only the Discovery flow has the interpolation bug.**

---

## Part 2: Discovery Flow Bug Details

### Root Cause
The `apply_category` question (index 9) in the database has:

```json
{
  "id": "apply_category",
  "type": "textarea",           // ❌ WRONG - should be "select"
  "prompt": "...What is ONE specific action you will take within the next 24 hours to apply this learning?",  // ❌ WRONG prompt
  "options": ["BALANCE", "BODY", "BEING", "BUSINESS"],  // Correct but ignored
  "interpolation_key": "apply_category"
}
```

The next question (`apply_lesson`) expects `{apply_category}` to be a domain like "BUSINESS" but instead gets the user's action text.

### Fix: Database Update

```sql
UPDATE flow_templates 
SET questions_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'id' = 'apply_category' THEN 
        jsonb_build_object(
          'id', 'apply_category',
          'type', 'select',
          'prompt', 'What Category of life would you like to apply this discovery?',
          'options', jsonb_build_array('BALANCE', 'BODY', 'BEING', 'BUSINESS'),
          'required', true,
          'interpolation_key', 'apply_category'
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(questions_json) AS elem
),
updated_at = now()
WHERE slug = 'discovery';
```

**Result**: The `apply_category` question becomes a 4-option select dropdown, and selecting "BUSINESS" will correctly interpolate into the next question.

---

## Part 3: Show Full Flow on Completion Page

### Current State
- `StaffFlowComplete.tsx` shows AI analysis only
- `FlowReportCard.tsx` (used in owner view) shows AI analysis AND full Q&A responses
- Staff users don't see their responses after completing a flow

### Solution
Add the Q&A section to `StaffFlowComplete.tsx`, matching the pattern in `FlowReportCard.tsx`.

### File: `src/pages/staff/StaffFlowComplete.tsx`

**Changes:**

1. Add state for parsed questions:
```typescript
const [questions, setQuestions] = useState<FlowQuestion[]>([]);
```

2. Store questions when loading session (already being parsed in `templateData`):
```typescript
setQuestions(templateData.questions_json);
```

3. Add interpolation helper (same as FlowReportCard):
```typescript
const interpolatePrompt = (prompt: string): string => {
  let result = prompt;
  const matches = prompt.match(/\{([^}]+)\}/g);
  
  if (matches && session?.responses_json) {
    matches.forEach(match => {
      const key = match.slice(1, -1);
      const sourceQuestion = questions.find(
        q => q.interpolation_key === key || q.id === key
      );
      if (sourceQuestion && session.responses_json[sourceQuestion.id]) {
        result = result.replace(match, session.responses_json[sourceQuestion.id]);
      }
    });
  }
  
  return result;
};
```

4. Add "Your Flow Responses" section after the AI Analysis Card (around line 351):
```tsx
{/* Full Flow Q&A Section */}
<Card className="mb-6 border-border/10">
  <CardContent className="p-6">
    <h2 className="font-medium text-lg mb-6">Your Flow Responses</h2>
    <div className="space-y-6">
      {questions.map((question) => {
        const response = session.responses_json?.[question.id];
        if (!response) return null;
        
        return (
          <div key={question.id} className="border-b border-border/10 pb-6 last:border-0">
            <p className="text-muted-foreground/70 text-sm mb-2">
              {interpolatePrompt(question.prompt)}
            </p>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {response}
            </p>
          </div>
        );
      })}
    </div>
  </CardContent>
</Card>
```

---

## Part 4: Fix Build Errors (Pre-existing)

Several edge functions have TypeScript errors that need fixing. These are unrelated to flows but are blocking deployment:

### Critical Fix: `assign_onboarding_sequence/index.ts`
- Line 108: `agencyId = agencyId;` - variable used before assignment

### Type Safety Fixes (multiple files):
- Cast `error` as `Error` type: `(error as Error).message`
- Add explicit types for callback parameters

---

## Summary of Files to Change

| File | Change |
|------|--------|
| Database migration | Fix Discovery flow `apply_category` question |
| `src/pages/staff/StaffFlowComplete.tsx` | Add full Q&A section after AI analysis |
| `supabase/functions/assign_onboarding_sequence/index.ts` | Fix `agencyId` variable assignment |
| Multiple edge functions | Fix TypeScript type errors |

---

## Testing Checklist

After implementation:

1. **Discovery Flow Fix**:
   - Start a new Discovery Flow
   - At `apply_category` question, verify it shows a 4-option dropdown (BALANCE/BODY/BEING/BUSINESS)
   - Select "BUSINESS" and advance
   - Verify `apply_lesson` prompt shows: "...How does this lesson apply to your **BUSINESS** domain?"

2. **Flow Completion View**:
   - Complete any flow (Grateful, Bible, or Discovery)
   - On completion page, verify:
     - AI revelation/analysis appears at top
     - Full Q&A responses appear below
     - Questions show with interpolated values filled in

3. **Other Flows Still Work**:
   - Run through a Grateful flow - verify `{trigger}` and `{story}` interpolate correctly
   - Run through a Bible flow - verify conditional questions appear/hide correctly

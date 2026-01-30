

# Enhance Call Scoring Feedback Detail in Prompt Generator

## Problem Identified

The current `generateSalesPrompt` function provides minimal guidance to GPT on how to structure section feedback:

**Current instructions (lines 30-33):**
```
For EACH section, provide:
- 3-4 sentences of specific feedback
- A concrete improvement tip if score < 8
- Score: X/10
```

**Current JSON example (lines 53-60):**
```json
"skill_scores": [
  {
    "skill_name": "<section name>",
    "score": <0-10>,
    "max_score": 10,
    "feedback": "<feedback>",
    "tip": "<tip or null>"
  }
]
```

This vague format results in GPT generating brief, generic one-liners like:
> "Ensure all verification procedures are clearly communicated to the client to enhance transparency and trust."

---

## Solution

Rewrite the prompt instructions to explicitly require a structured STRENGTHS/GAPS/ACTION format with minimum length requirements and specific examples.

---

## Changes to `src/components/admin/call-scoring/promptGenerator.ts`

### 1. Replace the section feedback instructions (lines 30-33)

**Current:**
```
For EACH section, provide:
- 3-4 sentences of specific feedback
- A concrete improvement tip if score < 8
- Score: X/10
```

**New:**
```
SECTION FEEDBACK REQUIREMENTS:
For EACH scored section, provide detailed coaching feedback with this structure:

1. STRENGTHS: What the rep did well in this area. Include specific quotes or moments from the transcript when possible. (1-2 sentences minimum)

2. GAPS: What was missed, incomplete, or could be improved. Be specific about behaviors or statements that should have happened but didn't. (1-2 sentences minimum)

3. ACTION: One concrete, specific behavior to practice on the very next call. Make it actionable, not generic advice. (1 sentence)

4. TIP: A single memorable coaching takeaway for quick reference. This should be something the rep can easily remember and apply.

IMPORTANT: Avoid generic feedback like "improve communication skills" or "be more thorough." Every piece of feedback must reference something specific from THIS call.
```

### 2. Update the JSON output format example (lines 53-60)

**Current:**
```json
"skill_scores": [
  {
    "skill_name": "<section name>",
    "score": <0-10>,
    "max_score": 10,
    "feedback": "<feedback>",
    "tip": "<tip or null>"
  }
]
```

**New:**
```json
"skill_scores": [
  {
    "skill_name": "<section name>",
    "score": <0-10>,
    "max_score": 10,
    "feedback": "STRENGTHS: [specific example of what rep did well, with quote if available]. GAPS: [specific behavior or statement that was missed or incomplete]. ACTION: [one concrete thing to practice on the next call].",
    "tip": "<one memorable coaching takeaway for quick reference>"
  }
]
```

### 3. Apply same changes to `generateServicePrompt` function (lines 100-103)

Update the service call prompt with the same enhanced feedback structure for consistency across both call types.

---

## Expected Output After Fix

**Before (current generic feedback):**
```json
{
  "skill_name": "Process Discipline",
  "score": 8,
  "max_score": 10,
  "feedback": "Ensure all verification procedures are clearly communicated to the client.",
  "tip": null
}
```

**After (rich coaching feedback):**
```json
{
  "skill_name": "Process Discipline",
  "score": 8,
  "max_score": 10,
  "feedback": "STRENGTHS: Rep asked permission before pulling reports ('Mind if I grab your driving history real quick?') and gathered information systematically before quoting. GAPS: Did not confirm the client understood coverage options before moving to price - jumped straight from explaining liability limits to the premium. ACTION: After explaining each coverage type, pause and ask 'Does that make sense for your situation?' before continuing.",
  "tip": "Confirm understanding before moving to the next coverage type."
}
```

---

## Technical Details

**File to modify:** `src/components/admin/call-scoring/promptGenerator.ts`

**Functions affected:**
- `generateSalesPrompt()` - Primary target (lines 17-73)
- `generateServicePrompt()` - Apply same pattern for consistency (lines 87-139)

**No database or edge function changes required** - this is purely a prompt text update that will affect all new call scoring analyses.

---

## Testing Recommendation

After implementation, process a test call transcript through the scoring system and verify the `skill_scores` array contains feedback with the STRENGTHS/GAPS/ACTION structure and populated `tip` fields.




# Update Scorecard AI Coaching Prompt

## What's Changing
Replacing the current AI system prompt in the scorecard feedback email function with the new "Agency Brain Performance Coach" persona and output structure.

## Current State
The prompt lives in `supabase/functions/send_submission_feedback/index.ts` and uses a supportive coaching tone with bullet-point feedback organized by Champion/Grinder/Alert tiers.

## New Prompt
The updated prompt will use a direct, visceral coaching tone with:
- No excessive formatting (minimal bolding/asterisks)
- "I" and "you" language (no "the data shows")
- 150-word limit
- Output: one-sentence tier headline, a "Pulse Check" on effort vs. results, and one "Hard Truth" or "Actionable Shift"

## Technical Details

**File:** `supabase/functions/send_submission_feedback/index.ts`

The system prompt (currently in the `generateAIFeedback` function) will be replaced with:

```
You are the Agency Brain, a high-stakes Performance Coach. Your tone is direct, visceral, and results-obsessed—think of a world-class athletic coach who cares about the person but refuses to accept a losing season.

The Rules:
- No Excessive Formatting: Avoid over-using bolding or asterisks. Keep it clean.
- Lead with the Lead: Start with the "Tier" status as a headline.
- Human Language: Use "I" and "you." Avoid "the data shows" or "however."
- The 150-Word Wall: Keep it punchy.

Step 1: Categorization
- Champion (All Wins): They didn't just work; they dominated. High praise.
- Grinder (Mixed/Near Miss): They are in the fight but losing the efficiency battle. Focus on the "Gap."
- The Alert (Critical Misses): Radical honesty. If the numbers are this low, the activity isn't translating to income.

Output Structure:
- A one-sentence headline based on Tier.
- A brief "Pulse Check" on the effort (calls) vs. results (quotes/sales).
- One "Hard Truth" or "Actionable Shift" for tomorrow.
```

The existing tier classification logic (Win >= target, Near Miss 80-99%, Miss 50-79%, Critical Miss < 50%) and the user message with metrics data remain unchanged -- only the system prompt personality and output format changes.

## Notes
- This change is blocked by the 19 edge function build errors and 9 frontend errors listed above. Those must be fixed first (or simultaneously) for this to deploy.
- No other files need to change -- the prompt is entirely contained in the one edge function.




# Improve Talk-to-Listen Ratio Heuristics

## Problem
The same audio file produces wildly different agent/customer talk percentages (42%, 49%, 53%, 56%) because the current heuristics are too sensitive to Whisper's non-deterministic segment boundaries.

## Current Heuristic Issues (lines 165-220)

The `calculateTalkMetrics()` function has these problems:

1. **Keyword triggers are too aggressive** - Single phrases like "I need" flip the entire speaker assignment
2. **Gap-based switching is too sensitive** - A 1-second gap triggers a speaker flip, causing cascading errors
3. **No momentum/smoothing** - Each segment is evaluated independently with no context from surrounding segments
4. **First-segment bias** - Assumes agent always speaks first, which may not be true

---

## Solution: Improved Heuristics with Smoothing

### Changes to `supabase/functions/transcribe-call/index.ts`

#### 1. Add Speaker Confidence Scoring Instead of Binary Flipping

Replace the current binary speaker assignment with a **confidence-weighted approach**:

- Each segment gets an "agent confidence score" based on multiple signals
- Use a **smoothing window** of 3-5 segments to prevent single-segment noise from flipping speakers
- Only switch speakers when confidence crosses a threshold AND persists across multiple segments

#### 2. Expand Keyword Patterns for Better Detection

Add more comprehensive phrase patterns:

**Agent indicators** (expanded):
- Formal language: "your policy", "your account", "let me check", "I'll look into"
- Insurance-specific: "coverage", "premium", "deductible", "effective date", "renewal"
- Service phrases: "I can help", "what I can do for you", "let me pull up"
- Professional closers: "is there anything else", "have a great day"

**Customer indicators** (expanded):
- Question patterns: "how much", "what about", "can you", "do you have"
- Request language: "I need", "I want", "I'm looking for", "could you"
- Problem statements: "I have a question", "I'm calling because", "my issue is"
- Personal references: "my current policy", "my car", "my house", "my payment"

#### 3. Add Smoothing Window

Implement a **3-segment lookback** to prevent single-segment noise:

```text
Segment analysis flow:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Seg N-2 │───▶│ Seg N-1 │───▶│ Seg N   │───▶│ Decision│
│ Agent:70│    │ Agent:60│    │ Agent:40│    │ = Agent │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                           (weighted average = 56% agent)
```

Only switch speaker when the weighted average crosses below 40% (or above 60%) for agent.

#### 4. Reduce Gap Sensitivity

Change gap-based switching from 1.0s to **2.5s threshold**, and only use it as a **tiebreaker** when keyword confidence is neutral (40-60%).

---

## Implementation Details

### Updated `calculateTalkMetrics()` Function

```typescript
function calculateTalkMetrics(segments: any[], totalDuration: number) {
  let agentSeconds = 0;
  let customerSeconds = 0;
  let deadAirSeconds = 0;
  let lastEndTime = 0;
  
  // Expanded keyword patterns
  const agentPatterns = [
    /\b(your policy|your account|your coverage|your premium|your deductible)\b/i,
    /\b(let me|i can|i'll|i will|we offer|we have|we can)\b/i,
    /\b(looking at your|pulling up|checking your|i see here)\b/i,
    /\b(effective date|renewal|claims?|endorsement)\b/i,
    /\b(is there anything else|have a great day|thank you for calling)\b/i,
    /\b(what i can do|how can i help|may i help)\b/i,
  ];
  
  const customerPatterns = [
    /\b(i need|i want|i'm looking|i am looking|i was wondering)\b/i,
    /\b(how much|what about|can you|could you|do you)\b/i,
    /\b(my policy|my account|my car|my house|my payment|my coverage)\b/i,
    /\b(i have a question|i'm calling|i am calling|calling about)\b/i,
    /\b(the reason i'm calling|i received|i got a)\b/i,
  ];
  
  // Score each segment's agent probability (0-100)
  const segmentScores: number[] = segments.map((segment, index) => {
    const text = segment.text?.toLowerCase() || '';
    let agentScore = 50; // neutral baseline
    
    // Keyword scoring (+/- 25 points per match)
    agentPatterns.forEach(pattern => {
      if (pattern.test(text)) agentScore += 25;
    });
    customerPatterns.forEach(pattern => {
      if (pattern.test(text)) agentScore -= 25;
    });
    
    // First segment greeting bonus for agent
    if (index === 0 && /^(hi|hello|thank you for calling|good morning|good afternoon)/i.test(text.trim())) {
      agentScore += 30;
    }
    
    // Clamp to 0-100
    return Math.max(0, Math.min(100, agentScore));
  });
  
  // Apply 3-segment smoothing window
  const smoothedScores: number[] = segmentScores.map((score, index) => {
    const window = [
      segmentScores[index - 2] ?? score,
      segmentScores[index - 1] ?? score,
      score
    ];
    // Weighted average: current segment counts more
    return (window[0] * 0.2 + window[1] * 0.3 + window[2] * 0.5);
  });
  
  // Determine speaker per segment with hysteresis
  let currentSpeaker = 'agent';
  const SWITCH_THRESHOLD = 15; // Must differ by 15+ points from neutral to switch
  
  segments.forEach((segment, index) => {
    const segmentDuration = segment.end - segment.start;
    const smoothedScore = smoothedScores[index];
    
    // Dead air calculation
    if (segment.start > lastEndTime) {
      const gap = segment.start - lastEndTime;
      if (gap > 0.5) deadAirSeconds += gap;
    }
    lastEndTime = segment.end;
    
    // Speaker assignment with hysteresis
    if (smoothedScore > 50 + SWITCH_THRESHOLD) {
      currentSpeaker = 'agent';
    } else if (smoothedScore < 50 - SWITCH_THRESHOLD) {
      currentSpeaker = 'customer';
    }
    // If between 35-65, keep current speaker (hysteresis prevents flapping)
    
    // Long gap as tiebreaker only when score is neutral
    if (smoothedScore >= 35 && smoothedScore <= 65 && index > 0) {
      const gapFromPrevious = segment.start - segments[index - 1].end;
      if (gapFromPrevious > 2.5) {
        currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
      }
    }
    
    if (currentSpeaker === 'agent') {
      agentSeconds += segmentDuration;
    } else {
      customerSeconds += segmentDuration;
    }
  });
  
  // Round and calculate percentages (existing logic)
  agentSeconds = Math.round(agentSeconds);
  customerSeconds = Math.round(customerSeconds);
  deadAirSeconds = Math.round(deadAirSeconds);
  
  const total = agentSeconds + customerSeconds + deadAirSeconds;
  const effectiveTotal = total > 0 ? total : totalDuration;
  
  return {
    agentSeconds,
    customerSeconds,
    deadAirSeconds,
    agentPercent: effectiveTotal > 0 ? Math.round((agentSeconds / effectiveTotal) * 100 * 100) / 100 : 0,
    customerPercent: effectiveTotal > 0 ? Math.round((customerSeconds / effectiveTotal) * 100 * 100) / 100 : 0,
    deadAirPercent: effectiveTotal > 0 ? Math.round((deadAirSeconds / effectiveTotal) * 100 * 100) / 100 : 0,
  };
}
```

---

## Why This Reduces Variance

| Issue | Before | After |
|-------|--------|-------|
| Single keyword flips speaker | Yes - one "I need" = customer | No - needs 3+ segments to confirm |
| 1s gap causes flip | Yes | No - raised to 2.5s, only when score is neutral |
| No context awareness | Each segment independent | 3-segment weighted window |
| Binary decision | Agent OR customer per segment | Confidence score 0-100 with hysteresis |

---

## Expected Outcome
While not 100% deterministic (Whisper still varies), variance should drop significantly:
- **Before**: 42% → 56% agent (14 point swing)
- **After**: Expected 48% → 52% agent (4 point swing or less)

---

## Files to Modify
- `supabase/functions/transcribe-call/index.ts` - Replace `calculateTalkMetrics()` function (lines 165-220)


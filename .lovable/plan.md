

## Fix: Flow Questions Disappearing After Answering

### Root Cause

In `src/hooks/useFlowSession.ts` (lines 114-123), the "resume session" `useEffect` has `responses` and `visibleQuestions` in its dependency array, but `sessionLoadedFromDb` is never reset after the initial resume. This means:

1. User answers question 3 (a select chip like "NO")
2. `saveResponse` updates `responses`
3. The resume effect re-fires because `responses` changed and `sessionLoadedFromDb` is still `true`
4. It recalculates `firstUnanswered` and resets `currentQuestionIndex` — competing with the typing animation timeout that's also trying to call `goToNextQuestion()`
5. The result: questions flash, disappear, or show multiple at once

### Fix

**File: `src/hooks/useFlowSession.ts`**

Make the resume effect run only **once** after the session loads from DB, then disable itself. Change the effect to reset `sessionLoadedFromDb` to `false` after setting the index:

```
useEffect(() => {
  if (!loading && template && session && sessionLoadedFromDb) {
    const firstUnanswered = visibleQuestions.findIndex(q => !responses[q.id]);
    const newIndex = firstUnanswered === -1 ? visibleQuestions.length - 1 : firstUnanswered;
    setCurrentQuestionIndex(newIndex);
    setSessionLoadedFromDb(false);  // <-- prevent re-firing
  }
}, [loading, template, session, sessionLoadedFromDb]);
```

Also remove `visibleQuestions` and `responses` from the dependency array since we only want this to run on the initial load, not on every answer.

### Why This Is Safe

- `visibleQuestions` and `responses` are already populated by the time `loading` turns `false` and `sessionLoadedFromDb` is `true`, so the first unanswered calculation will be correct on the initial run.
- After the flag resets, normal question advancement (`goToNextQuestion`) handles all subsequent navigation without interference.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useFlowSession.ts` | Add `setSessionLoadedFromDb(false)` after setting index; trim dependency array |


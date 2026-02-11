

## Fix: Grateful Flow Answer Bleeding + Auth Expiry Recovery + Build Errors

### Data Status
Your Grateful Flow data is 100% saved and intact in the database (session `9f41479d-...`, status: `completed`, all responses present). Nothing was lost.

### What Went Wrong

1. **Auth token expired mid-flow** -- Your refresh token became invalid during the session, which caused "Flow template not found" when the page tried to re-query the template.
2. **Answer bleeding into next question** -- A React `useEffect` timing issue causes the input to briefly repopulate with the just-saved answer before the 2-second typing animation advances to the next question.

---

### Changes

#### 1. Fix answer bleeding in FlowSession.tsx (lines 139-146)

**Problem**: The effect `setCurrentValue(responses[currentQuestion.id] || '')` triggers whenever `responses` changes. When `saveResponse` updates `responses`, this fires while the OLD question is still active, re-populating the input with the saved answer.

**Fix**: Add a guard so the effect does NOT set `currentValue` when `isTyping` is true (the transition period between questions). Also clear `currentValue` immediately inside `handleSubmitAnswer` right after saving.

```
// Line ~322, after saveResponse call:
setCurrentValue('');  // Clear input immediately

// Line ~139, add isTyping guard:
useEffect(() => {
  if (currentQuestion && !isTyping) {
    setCurrentValue(responses[currentQuestion.id] || '');
    ...
  }
}, [currentQuestion?.id, responses, isTyping]);
```

#### 2. Fix GCTrendChart.tsx build error (line 96)

**Problem**: `ResponsiveContainer` expects a single child but receives multiple conditional `{view === 'x' ? <Chart/> : null}` children.

**Fix**: Wrap the conditional chart rendering so only one chart element is returned as the single child. Use a helper that returns just the active chart.

```tsx
<ResponsiveContainer width="100%" height="100%">
  {view === 'growth' ? (
    <AreaChart data={data}>...</AreaChart>
  ) : view === 'retention' ? (
    <ComposedChart data={data}>...</ComposedChart>
  ) : view === 'premium' ? (
    <ComposedChart data={data}>...</ComposedChart>
  ) : (
    <ComposedChart data={data}>...</ComposedChart>
  )}
</ResponsiveContainer>
```

#### 3. Fix test build error (line 64)

**Problem**: `reportUpdate` mock is typed with 0 parameters but called with `(payload)`.

**Fix**: Add the parameter type to the mock: `vi.fn((_payload?: Record<string, unknown>) => ({ eq: updateEq }))`.

#### 4. Fix edge function build errors (4 errors across 3 files)

| File | Fix |
|------|-----|
| `stripe-webhook/index.ts:42-43` | Cast `err` to `Error`: `(err instanceof Error ? err.message : String(err))` |
| `send_daily_summary/index.ts:134,162` | Cast `existing`/`created` with `as { id: string; version: number }` |
| `send_daily_summary/index.ts:247` | Cast supabase parameter: `resolveLockedSnapshotId(supabase as any, ...)` |
| `send_onboarding_overdue_alerts/index.ts:156` | Access first element: `task.instance` is an array from join; use `(task.instance as any)?.[0]` or cast through `unknown` first |
| `get_staff_lqs_data/index.ts:255` | Cast through `unknown`: `(page as unknown as LqsHousehold[])` |

### Summary of Files Modified

- `src/pages/flows/FlowSession.tsx` -- fix answer bleeding
- `src/components/growth-center/GCTrendChart.tsx` -- single-child fix
- `src/tests/growth-center/business-metrics-reports.hardening.test.ts` -- mock param type
- `supabase/functions/stripe-webhook/index.ts` -- unknown err handling
- `supabase/functions/send_daily_summary/index.ts` -- type casts
- `supabase/functions/send_onboarding_overdue_alerts/index.ts` -- array element access
- `supabase/functions/get_staff_lqs_data/index.ts` -- cast through unknown


# AI-Powered Natural Language Search — Replication Pattern

Use this document when building the AI natural language search bar for a new page (Cancel Audit, Contacts, etc.). It captures the complete architecture, every file, and the gotchas we hit building it for the Renewals page.

## What It Does

Users type natural language like "show me monolines with big increases in 43210" and the table auto-filters. They can refine ("now sort by premium") and the AI merges new filters with previous ones. "Clear" resets everything. Works for both JWT users (agency owners) and staff users (session token auth).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  UI Component (RenewalAISearch.tsx)                       │
│  - Input bar with rotating placeholder examples          │
│  - Yellow sparkles branding, "AI-Powered Search" title   │
│  - Summary banner when filters are active                │
│  - Turn count badge for conversation depth               │
└───────────────────┬──────────────────────────────────────┘
                    │ sendQuery(text)
                    ▼
┌──────────────────────────────────────────────────────────┐
│  React Hook (useRenewalAIQuery.ts)                       │
│  - Conversation state (ephemeral, React state only)      │
│  - useMutation → calls edge function                     │
│  - resultVersion counter for effect-safe updates         │
│  - Staff session header injection                        │
└───────────────────┬──────────────────────────────────────┘
                    │ supabase.functions.invoke()
                    ▼
┌──────────────────────────────────────────────────────────┐
│  Edge Function (parse_renewal_query/index.ts)            │
│  - Auth: staff session FIRST, then verifyRequest (JWT)   │
│  - Builds system prompt with filter fields + terminology │
│  - Injects agency-specific team members + product names  │
│  - Calls GPT-4o-mini (JSON mode, temp 0.1)              │
│  - Normalizes AI response (handles nesting quirks)       │
│  - Returns { result: AIQueryResponse, usage }            │
└───────────────────┬──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────┐
│  Page Integration (Renewals.tsx)                          │
│  - handleAIResult() maps AIQueryResponse → page state    │
│  - handleAIClear() resets all state to defaults          │
│  - useEffect with ref pattern bridges hook → page state  │
│  - Extended filters applied client-side in useMemo       │
└──────────────────────────────────────────────────────────┘
```

## Files Created (for Renewals — replicate per page)

### 1. Types — `src/types/renewalAIQuery.ts`

Defines the contract between edge function and frontend:

```typescript
interface AIQueryResponse {
  filters: AIRenewalFilters;  // All possible filter keys
  sort?: { column: string; direction: 'asc' | 'desc' };
  activeTab?: string;         // Optional tab switch
  summary: string;            // Human-readable description
  tip?: string;               // Optional insight
}

interface AIConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

**For a new page:** Create `src/types/<page>AIQuery.ts` with filter fields matching that page's data model.

### 2. Edge Function — `supabase/functions/parse_renewal_query/index.ts`

The AI brain. Key sections:

**Auth (CRITICAL — copy this exact pattern):**
```typescript
// Staff session FIRST, then JWT fallback.
// supabase.functions.invoke() always sends Authorization: Bearer <anon_key>
// which verifyRequest treats as a JWT, blocking the staff session path.
const staffSession = req.headers.get("x-staff-session");
if (staffSession) {
  // Validate staff session directly with service role client
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: session } = await supabaseAdmin
    .from("staff_sessions")
    .select("staff_user_id, expires_at, staff_users(agency_id, is_active)")
    .eq("session_token", staffSession)
    .single();
  // ... validate session ...
  agencyId = session.staff_users.agency_id;
} else {
  // JWT path via verifyRequest
  const authResult = await verifyRequest(req);
  // ...
}
```

**System Prompt Structure:**
```
1. Role description ("You are a [page name] filter assistant...")
2. Available filter fields with types and valid values
3. Sort columns
4. Tab options (if applicable)
5. Dynamic agency data (team members, product names, etc.)
6. Terminology map (what users say → what filter to set)
7. Rules (merge on refine, empty on clear, summary format, today's date)
```

**OpenAI Call:**
- Model: `gpt-4o-mini` (fast, cheap, good enough for structured extraction)
- `response_format: { type: "json_object" }` — forces valid JSON
- `temperature: 0.1` — deterministic
- `max_tokens: 1000`
- Conversation window: last 6 messages (3 turns) to keep costs low

**Response Normalization (handle AI quirks):**
```typescript
// AI sometimes nests sort/activeTab inside filters
const rawFilters = parsed.filters || {};
const sort = parsed.sort || rawFilters.sort || undefined;
const { sort: _s, activeTab: _t, summary: _sm, tip: _tp, ...cleanFilters } = rawFilters;
```

**For a new page:** Create `supabase/functions/parse_<page>_query/index.ts`. Change the system prompt to describe that page's filter fields, terminology, and domain. Keep auth + OpenAI call + normalization identical.

### 3. React Hook — `src/hooks/useRenewalAIQuery.ts`

Manages conversation state and API calls:

```typescript
export function useRenewalAIQuery({ teamMembers, productNames }) {
  const [conversation, setConversation] = useState<AIConversationMessage[]>([]);
  const [currentResult, setCurrentResult] = useState<AIQueryResponse | null>(null);
  const [resultVersion, setResultVersion] = useState(0);

  const mutation = useMutation({
    mutationFn: async (query: string) => {
      const headers: Record<string, string> = {};
      const staffToken = getStaffSessionToken();
      if (staffToken) headers['x-staff-session'] = staffToken;

      const { data, error } = await supabase.functions.invoke('parse_renewal_query', {
        body: { query, conversation, teamMembers, productNames },
        headers,
      });
      // ...
    },
    onSuccess: (data, query) => {
      setConversation(prev => [
        ...prev,
        { role: 'user', content: query },
        { role: 'assistant', content: JSON.stringify(data.result) },
      ]);
      setCurrentResult(data.result);
      setResultVersion(v => v + 1);  // Triggers the page effect
    },
  });
}
```

Key details:
- `resultVersion` counter — incremented on each new result so the page's `useEffect` fires reliably (can't depend on object identity)
- `conversation` is passed to the edge function on each call so the AI can merge/refine
- Staff session token injected via `x-staff-session` header
- `getStaffSessionToken()` imported from `@/lib/cancel-audit-api`

**For a new page:** Create `src/hooks/use<Page>AIQuery.ts`. Change the function name in `supabase.functions.invoke()` and the context params (e.g. Cancel Audit might pass `cancellationReasons` instead of `productNames`).

### 4. UI Component — `src/components/renewals/RenewalAISearch.tsx`

The visual search bar. **This component is generic and can be extracted to a shared component** — it only depends on `AIQueryResponse` type and callback props:

```typescript
interface Props {
  onClear: () => void;
  sendQuery: (query: string) => void;
  clearAIQuery: () => void;
  currentResult: AIQueryResponse | null;
  isLoading: boolean;
  isActive: boolean;
  turnCount: number;
}
```

Features:
- Rotating placeholder examples (4-second interval)
- Yellow sparkles icon in a badge, "AI-Powered Search by AgencyBrain AI" title
- Input with Enter to submit, Escape to clear
- Turn count badge when conversation has depth
- Summary banner with Clear button when filters are active
- Loading state: pulse animation on input, spin on sparkles icon

**For a new page:** Either reuse this exact component (make it generic) or copy and change the `PLACEHOLDER_EXAMPLES` array. The component itself doesn't know anything about renewal-specific filters.

## Page Integration Pattern (Renewals.tsx)

### Step 1: Wire the hook

```typescript
const aiQuery = useRenewalAIQuery({ teamMembers, productNames });
```

### Step 2: Map AI result to page state

```typescript
const handleAIResult = (result: AIQueryResponse) => {
  const { filters, sort, activeTab } = result;
  // Map each filter key to the corresponding page setState call
  // Reset toggles to defaults first, then apply AI overrides
  // Set extended filters for client-side range checks
};
```

### Step 3: Handle clear

```typescript
const handleAIClear = () => {
  setFilters({});
  setSearchQuery('');
  setActiveTab('all');
  setSortCriteria([]);
  // Reset every toggle to its DEFAULT (not false — some default to true)
  setAiExtendedFilters({});
};
```

### Step 4: Bridge hook results to page state with useEffect + ref

```typescript
// Ref prevents the effect from re-firing when handler identity changes
const handleAIResultRef = useRef(handleAIResult);
handleAIResultRef.current = handleAIResult;

useEffect(() => {
  if (aiQuery.currentResult && aiQuery.resultVersion > 0) {
    handleAIResultRef.current(aiQuery.currentResult);
  }
}, [aiQuery.resultVersion, aiQuery.currentResult]);
```

### Step 5: Client-side extended filters in useMemo

For filters that can't be done server-side (range checks on premium, etc.):

```typescript
const filteredRecords = useMemo(() => {
  let result = records;
  if (aiExtendedFilters.premiumChangePercentMin != null) {
    result = result.filter(r => (r.premium_change_percent ?? 0) >= aiExtendedFilters.premiumChangePercentMin!);
  }
  // ... other range checks ...
  return result;
}, [records, aiExtendedFilters]);
```

### Step 6: Place the component in JSX

```tsx
<RenewalAISearch
  onClear={handleAIClear}
  sendQuery={aiQuery.sendQuery}
  clearAIQuery={aiQuery.clearAIQuery}
  currentResult={aiQuery.currentResult}
  isLoading={aiQuery.isLoading}
  isActive={aiQuery.isActive}
  turnCount={aiQuery.turnCount}
/>
```

## Config

Add to `supabase/config.toml`:
```toml
[functions.parse_<page>_query]
verify_jwt = false
```

`verify_jwt = false` is required because staff users don't have a real JWT — the function handles auth internally.

## Bugs We Hit (Avoid These)

| Bug | What Happened | Prevention |
|-----|---------------|------------|
| **Staff auth blocked** | `supabase.functions.invoke()` always sends `Authorization: Bearer <anon_key>`. `verifyRequest()` sees this as a JWT, tries `getUser(anon_key)`, fails, never reaches staff session path. | Always check `x-staff-session` header FIRST before calling `verifyRequest()`. Copy the auth pattern above exactly. |
| **Variable used before definition** | `useRenewalAIQuery({ productNames })` was called before `useRenewalProductNames()` defined `productNames`. | Declare data-fetching hooks BEFORE the AI query hook that consumes their results. |
| **Stale toggles on new query** | User queries "show monolines" (sets bundledStatus), then "show priority" (sets showPriorityOnly). bundledStatus persisted from first query because handleAIResult only set what the AI returned. | Reset ALL toggles to their defaults first, then apply AI overrides. |
| **useEffect infinite loop** | `handleAIResult` was in the useEffect dependency array. It's a new function every render → infinite loop. | Use `useRef` to hold the handler, update `.current` on every render, depend only on `resultVersion`. |
| **Wrong project deployment** | Deployed edge function to wrong Supabase project (linked project vs config.toml project). | Always check `supabase/.temp/project-ref` and `supabase/config.toml project_id` match. Deploy with `--project-ref` matching the `.env` URL. |

## Deployment Checklist

1. Create edge function in `supabase/functions/<name>/index.ts`
2. Add `[functions.<name>]` with `verify_jwt = false` to `supabase/config.toml`
3. Deploy: `npx supabase functions deploy <name> --project-ref <correct-ref>`
4. Verify `OPENAI_API_KEY` is set in Supabase dashboard → Edge Functions → Secrets
5. Test with curl using both JWT and staff session auth
6. Push code — CI auto-deploys edge functions on merge to main

## Adapting for Cancel Audit

When building for Cancel Audit, the main differences will be:

1. **Filter fields** — Replace renewal-specific fields (premium, bundled status, product name) with cancel audit fields (cancellation reason, policy status, retention outcome, effective date, agent, etc.)
2. **Terminology map** — Map cancel audit language ("retained", "winback", "cancelled", "pending review", "high value") to structured filters
3. **Context injection** — Instead of `teamMembers` and `productNames`, pass whatever dynamic lists the cancel audit page uses (cancellation reasons, agents, status options)
4. **Page state mapping** — `handleAIResult` maps to Cancel Audit's filter state instead of Renewals state
5. **Edge function name** — `parse_cancel_audit_query` (new function, same architecture)

Everything else (auth, OpenAI call, conversation management, UI component, hook structure, normalization) stays identical.

## Reference Files

| File | Purpose |
|------|---------|
| `src/types/renewalAIQuery.ts` | Type definitions |
| `src/hooks/useRenewalAIQuery.ts` | React hook (conversation + mutation) |
| `src/components/renewals/RenewalAISearch.tsx` | UI component (reusable) |
| `supabase/functions/parse_renewal_query/index.ts` | Edge function (AI brain) |
| `src/pages/Renewals.tsx` lines 168-272 | Page integration (hook + effect + handlers) |
| `src/hooks/useRenewalRecords.ts` | Server-side filter extensions (zip/city/state) |
| `supabase/functions/get_staff_renewals/index.ts` | Staff path filter extensions |
| `supabase/config.toml` | Edge function registration |

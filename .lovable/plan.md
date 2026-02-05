
# Fix: Browser Tab Title Not Updating on Flow Pages

## Problem
When navigating to flow session pages (like `/flows/session/bible`), the browser tab title doesn't update - it remains whatever it was on the previous page (e.g., "Sequence Builder").

## Root Cause
The `FlowSession.tsx` page (and related flow pages) never call `document.title = ...`, unlike other pages in the app that do set it.

## Solution
Add `document.title` updates to all flow-related pages that are missing them.

## Files to Update

| File | New Title Format |
|------|------------------|
| `src/pages/flows/FlowSession.tsx` | `"{template.name} | AgencyBrain"` (e.g., "Bible \| AgencyBrain") |
| `src/pages/flows/FlowsHub.tsx` | `"My Flows | AgencyBrain"` |
| `src/pages/flows/FlowStart.tsx` | `"Start {template.name} | AgencyBrain"` |
| `src/pages/flows/FlowComplete.tsx` | `"Flow Complete | AgencyBrain"` |
| `src/pages/staff/StaffFlowSession.tsx` | `"{template.name} | AgencyBrain"` |
| `src/pages/staff/StaffFlowStart.tsx` | `"Start {template.name} | AgencyBrain"` |

## Implementation

For `FlowSession.tsx`, add a `useEffect` that updates the title when the template loads:

```tsx
useEffect(() => {
  if (template?.name) {
    document.title = `${template.name} | AgencyBrain`;
  } else {
    document.title = "Flow Session | AgencyBrain";
  }
}, [template?.name]);
```

Similar pattern for other pages, using the appropriate dynamic title based on the template or static text.

## Technical Notes
- Title updates when `template` data loads from the database
- Fallback title used while loading or if template is missing
- Follows existing app pattern (e.g., `Agency.tsx` uses `"My Agency | AgencyBrain"`)

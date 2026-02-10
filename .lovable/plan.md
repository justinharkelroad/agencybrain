
## Fix: Stop Auto-Expanding First Module on Standard Playbook Category Page

### Problem
When navigating to a Standard Playbook category (e.g., "Standard Sales Sequence"), the first incomplete module automatically expands. This is caused by lines 96-104 in `src/pages/staff/StaffSPCategory.tsx`, which find the first incomplete module and add it to the `expandedModules` set on load.

### Solution
Remove the auto-expand logic so all modules start collapsed. Users can manually click any module to expand it.

### Change
**File:** `src/pages/staff/StaffSPCategory.tsx`

Remove lines 96-104 (the block after `setModules(data.modules || [])` that auto-expands the first incomplete module):

```typescript
// DELETE THIS BLOCK:
// Auto-expand first incomplete module
const firstIncomplete = (data.modules || []).find((m: SPModule) =>
  m.lessons.some((l: SPLesson) => !l.completed)
);
if (firstIncomplete) {
  setExpandedModules(new Set([firstIncomplete.id]));
} else if (data.modules?.length > 0) {
  setExpandedModules(new Set([data.modules[0].id]));
}
```

The `expandedModules` state already initializes as an empty `Set`, so no replacement code is needed -- all modules will simply load collapsed.

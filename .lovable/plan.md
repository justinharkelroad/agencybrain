

# Fix: Manual Override "Apply to All" Should Support Row Selection

## Problem Summary

The **"Apply to All" button** in the Manual Override (Test Mode) panel applies override values to **every single row** in the table. This makes it impossible to test a specific team member's tier calculation without affecting everyone else.

For example:
- You want to test "What if Katie Cavera had 100 items instead of 89?"
- You enter `100` in Items Written and click "Apply to All"
- **All 22 producers** now show 100 items - not just Katie

## Current Design

| Feature | Current Behavior |
|---------|-----------------|
| Quick Apply to All | Applies bulk items/premium to **ALL** rows unconditionally |
| Per-row inputs | Each row has individual override inputs (works fine) |
| Row selection | **Does not exist** |

## Solution: Add Row Selection with "Apply to Selected"

Add checkboxes to select which team members should receive the bulk override values.

### New UI Components

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Quick Apply to Selected                                                 │
│                                                                         │
│ Items Written  │  Premium Written  │  [Apply to Selected]  [Clear All] │
│ [_______100__] │  [________5000__] │                                    │
│                                                                         │
│ Leave blank to use statement data. Enter values to override for testing │
│ Select rows below, then click "Apply to Selected"                       │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ [☐] │ Team Member      │ Code   │ Statement │ Statement  │ Override │   │
│     │                  │        │ Items     │ Premium    │ Items    │...│
├─────┼──────────────────┼────────┼───────────┼────────────┼──────────┼───│
│ [☐] │ Unmatched        │ 993    │ 1         │ $166       │ —        │   │
│ [☑] │ Katie Cavera     │ 428    │ 89        │ $66,313.78 │ —        │   │  ← Selected!
│ [☐] │ John Smith       │ 523    │ 45        │ $32,000.00 │ —        │   │
└─────┴──────────────────┴────────┴───────────┴────────────┴──────────┴───┘

Clicking "Apply to Selected" → Only Katie Cavera gets the override
```

### Changes Required

**File: `src/components/sales/ManualOverridePanel.tsx`**

1. **Add selection state** - Track which rows are selected via checkbox
2. **Add "Select All" checkbox** in header - Toggle all matched producers
3. **Rename "Apply to All"** → "Apply to Selected" with selection count badge
4. **Update `handleApplyBulk`** - Only apply to selected rows, not all rows
5. **Add checkbox column** to the table

---

## Technical Implementation

### Step 1: Add Selection State

Add a `Set<string>` to track selected sub-producer codes:

```typescript
const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

// Helper functions
const toggleSelection = (code: string) => {
  setSelectedCodes(prev => {
    const next = new Set(prev);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    return next;
  });
};

const toggleSelectAll = () => {
  const matchedCodes = producerData
    .filter(p => p.teamMember)
    .map(p => p.code);
  
  if (selectedCodes.size === matchedCodes.length) {
    setSelectedCodes(new Set()); // Deselect all
  } else {
    setSelectedCodes(new Set(matchedCodes)); // Select all matched
  }
};
```

### Step 2: Update Bulk Apply Logic

Change `handleApplyBulk` to only apply to selected rows:

```typescript
const handleApplyBulk = () => {
  if (selectedCodes.size === 0) {
    // Show warning toast
    return;
  }
  
  const itemsValue = bulkItems === "" ? null : parseInt(bulkItems, 10);
  const premiumValue = bulkPremium === "" ? null : parseFloat(bulkPremium);

  const updated = overrides.map((o) => {
    // Only update if this code is selected
    if (selectedCodes.has(o.subProdCode)) {
      return {
        ...o,
        writtenItems: itemsValue,
        writtenPremium: premiumValue,
      };
    }
    return o;
  });
  
  onChange(updated);
  setSelectedCodes(new Set()); // Clear selection after apply
};
```

### Step 3: Update UI

**Bulk Apply Section:**
- Change label from "Quick Apply to All" → "Quick Apply to Selected"
- Change button text: "Apply to All" → "Apply to Selected (X)"
- Add helper text about selecting rows
- Disable button when no rows selected

**Table:**
- Add checkbox column as first column
- Add "Select All" checkbox in header (only selects matched producers)
- Disable checkbox for unmatched rows (can't override unmatched producers)

### Step 4: Clear Selection When Needed

Clear selection when:
- User clicks "Clear All"
- Underlying sub-producer data changes
- User successfully applies overrides

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Lines 53-55 | Add `selectedCodes` state |
| Lines 144-154 | Update `handleApplyBulk` to filter by selection |
| Lines 156-168 | Update `handleClearAll` to also clear selection |
| Lines 227-266 | Update "Quick Apply" section labels and button |
| Lines 271-287 | Add checkbox column header with Select All |
| Lines 290-350 | Add checkbox input to each row |

---

## User Experience After Fix

1. User expands "Manual Override (Test Mode)"
2. User sees all producers in the table with checkboxes
3. User checks the box next to "Katie Cavera"
4. User enters "100" in Items Written
5. User clicks "Apply to Selected (1)"
6. **Only Katie Cavera** gets the override value of 100
7. All other producers remain unchanged

This allows proper "what-if" testing for individual team members or any subset of the team.




# Add Bundled vs Monoline Override Fields to Manual Override Panel

## Problem Summary

Currently, the Manual Override panel only allows overriding **total** items and premium. This prevents proper testing when the compensation plan uses `bundle_configs` with different rates for:
- **Monoline** (single product)
- **Standard** (2 products bundled)  
- **Preferred** (3+ products bundled)

You need to test specific scenarios like: **"54 bundled items @ $40K premium + 6 monoline items @ $5K premium"** to verify tiers and commission rates are calculating correctly.

## Current Limitation

| Field | Current State | Needed |
|-------|---------------|--------|
| Total Items | Exists | Keep |
| Total Premium | Exists | Keep |
| Bundled Items | Missing | Add |
| Bundled Premium | Missing | Add |
| Monoline Items | Missing | Add |
| Monoline Premium | Missing | Add |

## Solution Overview

Extend the `ManualOverride` interface and UI to support bundle-type-specific overrides. When these are provided, the calculator will use them to build a synthetic `byBundleType` array for commission calculations.

---

## UI Design

### Quick Apply Section (Updated)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Quick Apply to Selected                                                         │
│                                                                                 │
│ TOTAL (for tier qualification)                                                  │
│ Items Written  [____60____]   Premium Written  [____45000____]                 │
│                                                                                 │
│ BUNDLE BREAKDOWN (for commission calculation)                                   │
│ Bundled Items [____54____]  Bundled Premium [____40000____]                    │
│ Monoline Items [____6____]  Monoline Premium [____5000____]                    │
│                                                                                 │
│ [Apply to Selected (1)]  [Clear All]                                           │
│                                                                                 │
│ Leave bundle breakdown blank to distribute based on original statement ratios  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Per-Row Table (Expanded)

Add new columns for bundle breakdown per producer:

| Select | Team Member | Code | Stmt Items | Stmt Premium | Override Items | Override Premium | Bundled Items | Bundled Premium | Monoline Items | Monoline Premium |
|--------|------------|------|------------|--------------|----------------|------------------|---------------|-----------------|----------------|------------------|
| ☑ | Katie Cavera | 428 | 89 | $66,313 | 60 | $45,000 | 54 | $40,000 | 6 | $5,000 |

---

## Technical Changes

### 1. Extend ManualOverride Interface

Update in 3 locations:
- `src/components/sales/ManualOverridePanel.tsx`
- `src/lib/payout-calculator/calculator.ts`
- `src/hooks/usePayoutCalculator.ts`

```typescript
export interface ManualOverride {
  subProdCode: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
  
  // Total metrics (for tier qualification)
  writtenItems: number | null;
  writtenPremium: number | null;
  writtenPolicies: number | null;
  writtenHouseholds: number | null;
  writtenPoints: number | null;
  
  // NEW: Bundle breakdown (for commission calculation)
  bundledItems: number | null;
  bundledPremium: number | null;
  monolineItems: number | null;
  monolinePremium: number | null;
}
```

### 2. Update ManualOverridePanel.tsx

**New state variables:**
```typescript
const [bulkBundledItems, setBulkBundledItems] = useState<string>("");
const [bulkBundledPremium, setBulkBundledPremium] = useState<string>("");
const [bulkMonolineItems, setBulkMonolineItems] = useState<string>("");
const [bulkMonolinePremium, setBulkMonolinePremium] = useState<string>("");
```

**Update handleApplyBulk:**
- Include bundle breakdown fields when applying to selected rows

**Update handleClearAll:**
- Reset all new fields to null

**Update UI:**
- Add "Bundle Breakdown" section in Quick Apply
- Add 4 new columns to the per-producer table
- Add clear helper text explaining the difference between "Total" (tier) and "Bundle" (commission)

### 3. Update Calculator Logic

In `src/lib/payout-calculator/calculator.ts`, modify the override application section (around line 1455-1473):

```typescript
// Apply manual overrides if present
const override = overrideByCode.get(code);
if (override) {
  // Existing: Total metrics for tier qualification
  if (override.writtenItems !== null) {
    performance.writtenItems = override.writtenItems;
  }
  if (override.writtenPremium !== null) {
    performance.writtenPremium = override.writtenPremium;
  }
  // ... other existing fields
  
  // NEW: Bundle breakdown for commission calculation
  if (override.bundledItems !== null || override.monolineItems !== null ||
      override.bundledPremium !== null || override.monolinePremium !== null) {
    
    // Build synthetic byBundleType array from overrides
    performance.byBundleType = [];
    
    const bundledItems = override.bundledItems ?? 0;
    const bundledPremium = override.bundledPremium ?? 0;
    const monolineItems = override.monolineItems ?? 0;
    const monolinePremium = override.monolinePremium ?? 0;
    
    if (bundledItems > 0 || bundledPremium > 0) {
      performance.byBundleType.push({
        bundleType: 'standard', // "bundled" maps to standard in most plans
        premiumWritten: bundledPremium,
        premiumChargebacks: 0,
        netPremium: bundledPremium,
        itemsIssued: bundledItems,
        creditCount: bundledItems,
        chargebackCount: 0,
      });
    }
    
    if (monolineItems > 0 || monolinePremium > 0) {
      performance.byBundleType.push({
        bundleType: 'monoline',
        premiumWritten: monolinePremium,
        premiumChargebacks: 0,
        netPremium: monolinePremium,
        itemsIssued: monolineItems,
        creditCount: monolineItems,
        chargebackCount: 0,
      });
    }
    
    // Update issued metrics to match the bundle sum
    performance.issuedItems = bundledItems + monolineItems;
    performance.issuedPremium = bundledPremium + monolinePremium;
  }
}
```

---

## Summary of File Changes

| File | Changes |
|------|---------|
| `src/components/sales/ManualOverridePanel.tsx` | Add bundle breakdown fields to interface, state, UI inputs, and handlers |
| `src/lib/payout-calculator/calculator.ts` | Extend ManualOverride interface, apply bundle overrides to performance.byBundleType |
| `src/hooks/usePayoutCalculator.ts` | Update ManualOverride interface to match |

---

## User Experience After Implementation

1. User opens Manual Override panel
2. User selects "Katie Cavera" checkbox
3. User enters:
   - Items Written: `60` (for tier qualification)
   - Premium Written: `$45,000` (for tier qualification)
   - Bundled Items: `54`
   - Bundled Premium: `$40,000`
   - Monoline Items: `6`
   - Monoline Premium: `$5,000`
4. User clicks "Apply to Selected"
5. Calculator:
   - Uses 60 items to determine the tier (e.g., Tier 3)
   - Applies Tier 3's **bundled rate** to the $40K bundled premium
   - Applies Tier 3's **monoline rate** to the $5K monoline premium
   - Shows accurate projected commission

This allows precise testing of "what-if" scenarios with specific bundle mixes.


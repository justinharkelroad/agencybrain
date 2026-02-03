# Handoff Document: Policy Types → Product Types Linking

## Session Summary (Feb 3, 2026)

### Issues Fixed This Session

#### 1. Staff Sale Creation FK Error
**Problem:** Staff couldn't create sales - "Edge Function returned a non-2xx status code"
**Root Cause:** `sale_policies` and `sale_items` had FK constraints pointing to `product_types` table, but forms were using IDs from `policy_types` table (different tables with different IDs).
**Fix:** Migration `20260203163000_fix_sale_policies_fk_to_policy_types.sql` changed FK constraints to reference `policy_types`.

#### 2. Missing `brokered_counts_toward_bundling` Column
**Problem:** Console error "Could not find the 'brokered_counts_toward_bundling' column"
**Root Cause:** Migration `20260202130000` was marked as applied but never actually ran.
**Fix:** Repaired migration status and re-applied it.

#### 3. Points Showing 0 Instead of Actual Values
**Problem:** Standard Auto showed 0 points instead of 10.
**Root Cause:** Forms fetched from `policy_types` but hardcoded `default_points: 0` and `is_vc_item: false` instead of getting real values from `product_types`.
**Fix:** Created linking system (see below).

---

## Architecture: Two Tables Explained

### `product_types` (Global/System Table)
- Contains canonical product definitions with comp-related fields
- Fields: `id`, `name`, `category`, `default_points`, `is_vc_item`, `term_months`, `is_brokered`
- Has global records (`agency_id IS NULL`) used as defaults
- **This is the source of truth for compensation calculations**

### `policy_types` (Agency-Specific Table)
- Agency-customizable list of policy types
- Fields: `id`, `name`, `is_active`, `order_index`, `agency_id`, `product_type_id` (NEW)
- Agencies can rename, reorder, add custom types
- **This is what users see in dropdowns**

### The Link: `policy_types.product_type_id`
```
policy_types                         product_types
┌─────────────────────────┐         ┌────────────────────────────┐
│ id: "abc-123"           │         │ id: "xyz-789"              │
│ name: "Auto Insurance"  │ ──FK──► │ name: "Standard Auto"      │
│ product_type_id: "xyz"  │         │ default_points: 10         │
│ agency_id: "agency-1"   │         │ is_vc_item: true           │
└─────────────────────────┘         │ term_months: 6             │
                                    └────────────────────────────┘
```

---

## What Was Implemented

### 1. Database Migration
**File:** `supabase/migrations/20260203170000_link_policy_types_to_product_types.sql`

- Added `product_type_id` FK column to `policy_types`
- Backfilled existing records by matching names (case-insensitive)
- Added index for efficient joins

### 2. Updated Sale Forms

**Files:**
- `src/components/sales/StaffAddSaleForm.tsx`
- `src/components/sales/AddSaleForm.tsx`

**Changes:**
- Query now joins `policy_types` with `product_types`
- Gets real `default_points`, `is_vc_item` from linked product_type
- Added `canonical_name` field for bundle detection
- Bundle detection uses `canonical_name` (not display name) to match AUTO_PRODUCTS/HOME_PRODUCTS arrays
- `isMultiItemProduct()` also uses canonical_name

**Data Flow:**
```typescript
// Query returns:
{
  id: "abc-123",           // policy_types.id (used for FK in sale_policies)
  name: "My Auto",         // Display name (agency can customize)
  canonical_name: "Standard Auto",  // From product_types.name (for bundle detection)
  default_points: 10,      // From product_types
  is_vc_item: true,        // From product_types
}
```

---

## What Still Needs to Be Done

### Update PolicyTypeManager UI

**File:** `src/components/PolicyTypeManager.tsx`

**Current State:** Simple list with name, active toggle, reorder buttons. No indication of linking.

**Needed Changes:**

1. **Fetch linked product_type data:**
```typescript
const { data, error } = await supabase
  .from('policy_types')
  .select(`
    id, name, is_active, order_index,
    product_type:product_types(id, name, default_points, is_vc_item)
  `)
  .eq('agency_id', agencyId)
  .order('order_index', { ascending: true });
```

2. **Fetch global product_types for linking dropdown:**
```typescript
const { data: globalProductTypes } = await supabase
  .from("product_types")
  .select("id, name, category, default_points, is_vc_item")
  .is("agency_id", null)
  .eq("is_active", true)
  .order("name");
```

3. **Add visual indicator for linked/unlinked:**
```tsx
{type.product_type ? (
  <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
    <Link className="h-3 w-3 mr-1" />
    {type.product_type.default_points} pts
    {type.product_type.is_vc_item && " • VC"}
  </Badge>
) : (
  <Badge variant="outline" className="border-orange-500/50 text-orange-400">
    Not Linked
  </Badge>
)}
```

4. **Add link/unlink dropdown:**
```tsx
<Select
  value={type.product_type?.id || "unlinked"}
  onValueChange={(val) => handleLinkProductType(type.id, val === "unlinked" ? null : val)}
>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Link to..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="unlinked">-- Not Linked --</SelectItem>
    {globalProductTypes.map(pt => (
      <SelectItem key={pt.id} value={pt.id}>
        {pt.name} ({pt.default_points} pts)
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

5. **Update function to set product_type_id:**
```typescript
const handleLinkProductType = async (policyTypeId: string, productTypeId: string | null) => {
  const { error } = await supabase
    .from('policy_types')
    .update({ product_type_id: productTypeId })
    .eq('id', policyTypeId);

  if (error) {
    toast.error('Failed to update link');
    return;
  }

  // Refetch
  fetchPolicyTypes();
  toast.success(productTypeId ? 'Linked to compensation type' : 'Unlinked');
};
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/components/PolicyTypeManager.tsx` | **NEEDS UPDATE** - Admin UI for managing policy types |
| `src/components/sales/StaffAddSaleForm.tsx` | Staff sale form (updated) |
| `src/components/sales/AddSaleForm.tsx` | Admin sale form (updated) |
| `supabase/migrations/20260203170000_link_policy_types_to_product_types.sql` | Migration that added the FK |
| `src/lib/payout-calculator/calculator.ts` | Compensation calculator (uses bundle_type, points from sales table) |

---

## Bundle Detection Logic

**Location:** Both sale forms, lines ~70-95

```typescript
const AUTO_PRODUCTS = ['Standard Auto', 'Non-Standard Auto', 'Specialty Auto'];
const HOME_PRODUCTS = ['Homeowners', 'North Light Homeowners', 'Condo', 'North Light Condo'];

const detectBundleType = (policies: Policy[]) => {
  // Uses canonical_name (from linked product_types) for detection
  const productNames = policies.map(p => p.canonical_name || p.policy_type_name);

  const hasAuto = productNames.some(name => AUTO_PRODUCTS.includes(name));
  const hasHome = productNames.some(name => HOME_PRODUCTS.includes(name));

  if (hasAuto && hasHome) return { isBundle: true, bundleType: 'Preferred' };
  if (policies.length > 1) return { isBundle: true, bundleType: 'Standard' };
  return { isBundle: false, bundleType: null };
};
```

---

## Testing Checklist

- [ ] Create sale with Standard Auto → Should show 10 points
- [ ] Create sale with Standard Auto + Homeowners → Should detect as "Preferred Bundle"
- [ ] PolicyTypeManager shows linked/unlinked status
- [ ] Can link an unlinked policy type to a product_type
- [ ] Can unlink a linked policy type
- [ ] Unlinking a type makes it show 0 points in sale form

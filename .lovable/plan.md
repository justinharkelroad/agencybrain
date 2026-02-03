
# Plan: Unify Policy Types System

## Current Situation
- **88 agencies** in the system
- **25 default policy types** in `product_types` (the old system table)
- Some agencies already have policy types in their settings (up to 21), many have only 6
- The sales dropdown reads from `product_types`, but settings manages `policy_types`

## Solution Overview
1. **Migrate defaults**: Add all 25 default product types to every agency's `policy_types` (skip if they already have that name)
2. **Update code**: Change sales forms to read from `policy_types` instead of `product_types`
3. **Preserve everything**: No deletions - only additions

## Phase 1: Database Migration

Run a SQL migration that:
- Loops through all 88 agencies
- For each agency, inserts the 25 default product types into their `policy_types`
- Uses `ON CONFLICT DO NOTHING` to skip names that already exist
- Assigns order_index based on insertion order

```sql
-- Insert default policy types for all agencies that don't already have them
INSERT INTO policy_types (id, agency_id, name, is_active, order_index, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  a.id,
  pt.name,
  true,
  ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY pt.name) + COALESCE(
    (SELECT MAX(order_index) FROM policy_types WHERE agency_id = a.id), 0
  ),
  NOW(),
  NOW()
FROM agencies a
CROSS JOIN (
  SELECT DISTINCT name FROM product_types 
  WHERE agency_id IS NULL AND is_active = true
) pt
WHERE NOT EXISTS (
  SELECT 1 FROM policy_types 
  WHERE agency_id = a.id AND LOWER(name) = LOWER(pt.name)
);
```

**Result**: Every agency gets all 25 default types added (unless they already have them by name).

## Phase 2: Code Changes

### Files to Modify

1. **`src/components/sales/AddSaleForm.tsx`**
   - Change query from `product_types` to `policy_types`
   - Filter by `agency_id` and `is_active = true`
   - Order by `order_index`

2. **`src/components/sales/StaffAddSaleForm.tsx`**
   - Same changes as AddSaleForm

### Code Change Detail

```typescript
// BEFORE (reading from wrong table)
const { data: productTypes = [] } = useQuery({
  queryKey: ["product-types", profile?.agency_id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("product_types")
      .select("id, name, category, default_points, is_vc_item")
      .or(`agency_id.is.null,agency_id.eq.${profile?.agency_id}`)
      .eq("is_active", true)
      .order("name");
    // ...
  },
});

// AFTER (reading from settings table)
const { data: productTypes = [] } = useQuery({
  queryKey: ["policy-types-for-sales", profile?.agency_id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("policy_types")
      .select("id, name")
      .eq("agency_id", profile?.agency_id)
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return (data || []).map(pt => ({
      id: pt.id,
      name: pt.name,
      category: 'General',
      default_points: 0,
      is_vc_item: false
    }));
  },
  enabled: !!profile?.agency_id,
});
```

## What This Fixes

| Before | After |
|--------|-------|
| Settings changes don't affect dropdown | Settings changes immediately reflected |
| 25 defaults only shown for some | All agencies get all 25 defaults |
| Users confused about missing types | Consistent experience across agencies |
| "Motorcycle" missing from dropdown | "Motorcycle" (and all custom types) appear |

## Execution Order
1. Run database migration first (adds defaults to all agencies)
2. Then apply code changes (switches data source)
3. Test in one agency to verify

## Safety Guarantees
- **No deletions**: Only INSERT with conflict checking
- **Preserves custom types**: Existing agency policy_types untouched
- **Name-based deduplication**: Won't create duplicates if name already exists

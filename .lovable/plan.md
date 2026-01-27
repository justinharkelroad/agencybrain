

# Renewals Page Missing Pagination

## Root Cause

The Renewals page **does not have pagination implemented**. When Heather Ebersole (or any user) views their renewals, the page fetches and renders **all 428 records at once** in a single table with no page controls.

This causes:
- Slow page load times
- Poor user experience scrolling through hundreds of records
- Potential browser performance issues

## Evidence

| Component | Pagination Status |
|-----------|-------------------|
| Renewals | **None** - renders all records in one table |
| Winback | Has server-side pagination with `WinbackPagination` component |
| Contacts | Has infinite scroll pagination |
| LQS Households | Has server-side pagination with page controls |
| Sales Drilldown | Has server-side pagination using `.range()` |

The Renewals page (`src/pages/Renewals.tsx` line 649) maps through `filteredAndSortedRecords` directly without any slicing or pagination logic.

---

## Solution: Add Server-Side Pagination to Renewals

### Step 1: Update `useRenewalRecords` Hook

Add pagination parameters to the hook (`src/hooks/useRenewalRecords.ts`):

```typescript
export function useRenewalRecords(
  agencyId: string | null, 
  filters: RenewalFilters = {},
  page: number = 1,
  pageSize: number = 50
) {
  // For staff users: pass pagination to edge function
  // For regular users: add .range() to query
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  // Add to query: .range(from, to)
  // Use { count: 'exact' } to get total count
}
```

### Step 2: Update Edge Function `get_staff_renewals`

Modify to accept and apply pagination parameters:
- Accept `page` and `pageSize` in request body
- Apply `.range()` to the query
- Return `{ records, totalCount }` instead of just records

### Step 3: Add Pagination State to Renewals Page

Add state variables in `src/pages/Renewals.tsx`:

```typescript
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(50);
```

### Step 4: Create `RenewalsPagination` Component

Create a reusable pagination component (similar to `WinbackPagination`):
- Shows "Showing X-Y of Z records"
- Page size selector (25, 50, 100)
- Previous/Next navigation
- First/Last page buttons

### Step 5: Wire Up the Table

- Pass pagination params to `useRenewalRecords`
- Display total count from query
- Render pagination controls below the table
- Reset to page 1 when filters change

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useRenewalRecords.ts` | Add `page`, `pageSize` params; return `{ records, totalCount }` |
| `supabase/functions/get_staff_renewals/index.ts` | Accept pagination params; add `.range()` |
| `src/pages/Renewals.tsx` | Add pagination state; pass to hook; render pagination UI |
| `src/components/renewals/RenewalsPagination.tsx` | **New file** - pagination controls component |

---

## Technical Details

### Query Changes (Regular Users)

```typescript
const { data, error, count } = await supabase
  .from('renewal_records')
  .select('*, assigned_team_member:team_members!...', { count: 'exact' })
  .eq('agency_id', agencyId)
  .range(from, to);

return { records: data, totalCount: count };
```

### Edge Function Changes (Staff Users)

```typescript
// In get_staff_renewals edge function
const { page = 1, pageSize = 50 } = body;
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

query = query.range(from, to);

return { records: data, totalCount: count };
```

### UI Changes

Add below the table in `Renewals.tsx`:

```tsx
<RenewalsPagination
  currentPage={currentPage}
  pageSize={pageSize}
  totalCount={totalCount}
  onPageChange={setCurrentPage}
  onPageSizeChange={(size) => {
    setPageSize(size);
    setCurrentPage(1); // Reset on size change
  }}
/>
```

---

## Expected Outcome

After implementation:
- Renewals page loads 50 records at a time by default
- Users see "Showing 1-50 of 428 records"
- Page navigation buttons (First, Prev, Next, Last)
- Page size selector (25, 50, 100)
- Filter changes reset to page 1
- Significantly faster page loads for agencies with many renewals


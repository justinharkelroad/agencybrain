
# Fix: Sales Experience Assignment Constraint Bug

## Problem
The database constraint `one_active_per_agency` is incorrectly defined as `UNIQUE (agency_id, status)`, which means each agency can only have ONE assignment per status value (one pending, one active, one cancelled, etc.).

This prevents:
- Cancelling multiple assignments for the same agency
- Having historical cancelled/completed records

## Root Cause
**Current constraint:**
```sql
CONSTRAINT one_active_per_agency UNIQUE (agency_id, status)
```

**Intended behavior:** Only allow one "in-progress" (pending/active/paused) assignment per agency at a time, while allowing unlimited cancelled/completed historical records.

## Solution
Replace the table constraint with a partial unique index that only enforces uniqueness for non-terminal statuses.

### Database Migration

```sql
-- Drop the incorrect constraint
ALTER TABLE sales_experience_assignments 
DROP CONSTRAINT IF EXISTS one_active_per_agency;

-- Create correct partial unique index
-- This allows only ONE assignment per agency that is pending, active, or paused
-- But allows unlimited cancelled or completed assignments (historical records)
CREATE UNIQUE INDEX one_active_per_agency 
ON sales_experience_assignments(agency_id) 
WHERE status IN ('pending', 'active', 'paused');
```

## What This Fixes
- You can cancel the paused Example Insurance Agency assignment
- You can have multiple historical cancelled/completed records per agency
- Still enforces: only one "in-progress" assignment per agency at a time

## Files Changed
| File | Action |
|------|--------|
| New migration SQL | Create partial unique index to replace broken constraint |

## Impact
- No frontend code changes needed
- Only affects the database constraint logic
- Existing data remains intact

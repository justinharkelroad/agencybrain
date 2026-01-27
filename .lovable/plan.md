

# LQS Quote Upload Status Bug Fix

## Problem Summary

After uploading 178 quotes, the LQS Roadmap shows **0 Quoted Households** instead of the expected count. The data exists in the database but households are stuck in `'lead'` status instead of being updated to `'quoted'`.

## Root Cause

**The database trigger `trg_lqs_quotes_update_status` doesn't fire reliably during bulk uploads.**

| Current Behavior | Expected Behavior |
|------------------|-------------------|
| Quote upsert with `ignoreDuplicates: true` | Trigger fires on INSERT |
| Duplicate quotes are skipped (no INSERT) | Household status should update to 'quoted' |
| Trigger doesn't fire | 120 households have quotes but stuck in 'lead' status |

The trigger only fires on INSERT operations. When the same quote is uploaded again (duplicate), it's ignored, so no trigger fires. Even for new quotes, there may be timing/transaction isolation issues preventing the status update from persisting.

---

## Solution: Explicit Status Update After Quote Insertion

### Step 1: Add Post-Upload Status Correction

After inserting quotes for a household, explicitly update the household status instead of relying solely on the trigger:

```typescript
// After inserting quotes, explicitly update household status
if (quotesCreatedInGroup > 0) {
  await supabase
    .from('lqs_households')
    .update({
      status: 'quoted',
      first_quote_date: primaryRecord.quoteDate,
    })
    .eq('id', householdId)
    .eq('status', 'lead'); // Only update if still in 'lead' status
}
```

### Step 2: Create Data Repair Endpoint

Create a one-time repair function to fix existing households that have quotes but are stuck in 'lead' status:

```sql
-- Repair existing data
UPDATE lqs_households h
SET 
  status = 'quoted',
  first_quote_date = (SELECT MIN(quote_date) FROM lqs_quotes WHERE household_id = h.id),
  updated_at = now()
WHERE h.status = 'lead'
  AND EXISTS (SELECT 1 FROM lqs_quotes q WHERE q.household_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM lqs_sales s WHERE s.household_id = h.id);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useQuoteBackgroundUpload.ts` | Add explicit status update after quote insertion |

---

## Technical Details

### Modified Upload Flow

```text
Current Flow:
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│ Upsert Household    │───▶│ Upsert Quotes    │───▶│ Trigger (unreliable)│
│ (status: 'lead')    │    │ (ignoreDuplicates)│    │ Status stays 'lead' │
└─────────────────────┘    └──────────────────┘    └─────────────────────┘

Fixed Flow:
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐
│ Upsert Household    │───▶│ Upsert Quotes    │───▶│ Explicit Status Update  │
│ (status: 'lead')    │    │                  │    │ (if quotesCreated > 0)  │
└─────────────────────┘    └──────────────────┘    └─────────────────────────┘
```

### Code Change in useQuoteBackgroundUpload.ts

After line 264 (after the quote insertion loop), add:

```typescript
// Explicitly update household status to 'quoted' if we created any quotes
// This ensures status is correct even if the trigger doesn't fire
if (quotesCreatedInGroup > 0) {
  const minQuoteDate = groupRecords.reduce((min, r) => 
    r.quoteDate < min ? r.quoteDate : min, 
    groupRecords[0].quoteDate
  );
  
  await supabase
    .from('lqs_households')
    .update({
      status: 'quoted',
      first_quote_date: minQuoteDate,
    })
    .eq('id', householdId)
    .eq('status', 'lead'); // Don't overwrite 'sold' status
}
```

---

## Data Repair for Existing Records

After deploying the code fix, run this SQL to repair the 117 households currently affected:

```sql
UPDATE lqs_households h
SET 
  status = 'quoted',
  first_quote_date = (
    SELECT MIN(quote_date) 
    FROM lqs_quotes 
    WHERE household_id = h.id
  ),
  updated_at = now()
WHERE h.agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e'
  AND h.status = 'lead'
  AND EXISTS (SELECT 1 FROM lqs_quotes q WHERE q.household_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM lqs_sales s WHERE s.household_id = h.id);
```

---

## Expected Outcome

After implementing this fix:
- New quote uploads will immediately show households as "Quoted"
- The trigger becomes a backup rather than the primary mechanism
- Your 117 stuck households will be repaired and visible in the Quoted tab
- Future uploads won't have this synchronization issue


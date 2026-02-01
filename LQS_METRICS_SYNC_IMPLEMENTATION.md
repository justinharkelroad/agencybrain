# LQS ↔ Metrics Bidirectional Sync - Complete Implementation Plan

## Goal

**Single source of truth:** Every quoted household exists in `lqs_households` exactly once, and `metrics_daily.quoted_count` accurately reflects unique households quoted per team member per day.

| Entry Point | Creates LQS Record | Updates Metrics | Prevents Duplicates |
|-------------|-------------------|-----------------|---------------------|
| Dashboard "Add Quoted Household" | ✅ | ✅ | ✅ via household_key |
| Scorecard Submission | ✅ (NEW) | ✅ (existing) | ✅ via household_key |

---

## Deduplication Logic

**Matching Key:** `household_key` = `UPPER(last_name)_UPPER(first_name)_zip_code`

Example: "John Smith, 90210" → `SMITH_JOHN_90210`

**Rules:**
1. Before creating any `lqs_households` record, check if `household_key` already exists for that agency + date range
2. If exists → update existing record, do NOT increment metrics
3. If not exists → create new record, increment metrics (unless skip flag is set)

**Scenario: User submits scorecard with 3 households, then adds 1 via dashboard (which is a duplicate)**

1. Scorecard submission: 
   - Creates 3 `lqs_households` records
   - Sets `skip_metrics_increment = true` on all (scorecard already counted them)
   - `metrics_daily.quoted_count = 3`

2. Dashboard adds "John Smith, 90210" (duplicate of one from scorecard):
   - Finds existing `household_key = SMITH_JOHN_90210`
   - Updates existing record (not INSERT)
   - Trigger sees UPDATE but status already 'quoted' → no increment
   - `metrics_daily.quoted_count = 3` (unchanged, correct!)

---

## Current State (Verified)

| Component | Status |
|-----------|--------|
| `lqs_households.household_key` | ✅ Exists, format: `LASTNAME_FIRSTNAME_ZIP` |
| `lqs_households.skip_metrics_increment` | ❌ Does not exist |
| `lqs_quotes.source` | ✅ Exists, default 'manual' |
| `quoted_household_details.zip_code` | ⚠️ Column exists but always NULL (not collected) |
| `quotedDetails` form section | ❌ Missing zip_code field |
| `sync_quoted_household_to_lqs()` | ❌ Does not exist |
| Trigger on `lqs_households` | ❌ Does not exist |
| Trigger on `quoted_household_details` | ❌ Does not exist |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TWO ENTRY POINTS                               │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────────┐
                         │   Staff/Admin User   │
                         └──────────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
        ┌──────────────────────┐       ┌──────────────────────┐
        │ Dashboard Button     │       │ Scorecard Submission │
        │ "Add Quoted Household│       │ (quotedDetails)      │
        └──────────────────────┘       └──────────────────────┘
                   │                               │
                   │                               ▼
                   │                   ┌──────────────────────┐
                   │                   │ upsert_metrics_from_ │
                   │                   │ submission (existing)│
                   │                   │ → increments metrics │
                   │                   └──────────────────────┘
                   │                               │
                   │                               ▼
                   │                   ┌──────────────────────┐
                   │                   │ flatten_quoted_      │
                   │                   │ household_details    │
                   │                   │ (existing + update)  │
                   │                   └──────────────────────┘
                   │                               │
                   │                               ▼
                   │                   ┌──────────────────────┐
                   │                   │ quoted_household_    │
                   │                   │ details table        │
                   │                   └──────────────────────┘
                   │                               │
                   │                               ▼
                   │                   ┌──────────────────────┐
                   │                   │ TRIGGER: sync to LQS │
                   │                   │ (Phase 2 - NEW)      │
                   │                   │                      │
                   │                   │ • Generate key       │
                   │                   │ • Check if exists    │
                   │                   │ • Upsert with        │
                   │                   │   skip_metrics=true  │
                   │                   └──────────────────────┘
                   │                               │
                   ▼                               ▼
        ┌──────────────────────────────────────────────────────┐
        │                    lqs_households                     │
        │                                                       │
        │  Dedup via: household_key (unique per agency)         │
        │  Dashboard inserts/updates directly                   │
        │  Scorecard syncs via trigger                          │
        └──────────────────────────────────────────────────────┘
                                   │
                                   ▼
                      ┌──────────────────────┐
                      │ TRIGGER: increment   │
                      │ metrics (Phase 1)    │
                      │                      │
                      │ • Skip if flag set   │
                      │ • Skip if duplicate  │
                      │ • Otherwise increment│
                      └──────────────────────┘
                                   │
                                   ▼
                      ┌──────────────────────┐
                      │    metrics_daily     │
                      │    quoted_count      │
                      └──────────────────────┘
```

---

# PHASE 1: Dashboard → Metrics Trigger

**Goal:** When dashboard adds a quoted household, increment `metrics_daily.quoted_count`

## Phase 1.1: Add skip flag column

```sql
ALTER TABLE lqs_households 
ADD COLUMN IF NOT EXISTS skip_metrics_increment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN lqs_households.skip_metrics_increment IS 
  'When true, the metrics increment trigger skips this record. Set by scorecard sync to prevent double-counting.';
```

## Phase 1.2: Create helper function

```sql
CREATE OR REPLACE FUNCTION increment_metrics_quoted_count(
  p_agency_id uuid,
  p_team_member_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_team_member_id IS NULL THEN
    RAISE LOG 'increment_metrics_quoted_count: Skipping - no team_member_id';
    RETURN;
  END IF;

  INSERT INTO metrics_daily (agency_id, team_member_id, date, quoted_count)
  VALUES (p_agency_id, p_team_member_id, p_date, 1)
  ON CONFLICT (team_member_id, date) 
  DO UPDATE SET
    quoted_count = COALESCE(metrics_daily.quoted_count, 0) + 1,
    updated_at = now();
    
  RAISE LOG 'increment_metrics_quoted_count: Done for team_member=%, date=%', p_team_member_id, p_date;
END;
$$;
```

## Phase 1.3: Create trigger function

```sql
CREATE OR REPLACE FUNCTION increment_quoted_count_from_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check skip flag (set by scorecard sync)
  IF NEW.skip_metrics_increment = true THEN
    RAISE LOG 'increment_quoted_count_from_lqs: Skipping (flag set) household=%', NEW.id;
    NEW.skip_metrics_increment := false;
    RETURN NEW;
  END IF;

  -- Only increment on:
  -- 1. INSERT with status='quoted'
  -- 2. UPDATE from 'lead' to 'quoted'
  
  IF TG_OP = 'INSERT' AND NEW.status = 'quoted' THEN
    PERFORM increment_metrics_quoted_count(
      NEW.agency_id,
      NEW.team_member_id,
      COALESCE(NEW.first_quote_date, CURRENT_DATE)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'lead' AND NEW.status = 'quoted' THEN
    PERFORM increment_metrics_quoted_count(
      NEW.agency_id,
      NEW.team_member_id,
      COALESCE(NEW.first_quote_date, CURRENT_DATE)
    );
  END IF;
  
  RETURN NEW;
END;
$$;
```

## Phase 1.4: Register trigger

```sql
DROP TRIGGER IF EXISTS lqs_households_update_metrics ON lqs_households;

CREATE TRIGGER lqs_households_update_metrics
  BEFORE INSERT OR UPDATE ON lqs_households
  FOR EACH ROW
  EXECUTE FUNCTION increment_quoted_count_from_lqs();
```

## Phase 1 Verification

```sql
-- Check column
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'lqs_households' AND column_name = 'skip_metrics_increment';

-- Check trigger
SELECT tgname FROM pg_trigger WHERE tgrelid = 'lqs_households'::regclass;

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('increment_metrics_quoted_count', 'increment_quoted_count_from_lqs');
```

**Manual Test:** Add quoted household via dashboard → verify `metrics_daily.quoted_count` increments.

---

# PHASE 2: Form Schema Update (Require Zip Code)

**Goal:** Collect zip code on scorecard so we can generate matching `household_key`

## Phase 2.1: Update form_templates schema

Add `zip_code` field to the `quotedDetails` repeater section. This requires updating the form template's `schema_json`.

**Field definition to add:**

```json
{
  "key": "zip_code",
  "label": "Zip Code",
  "type": "text",
  "required": true,
  "placeholder": "Enter 5-digit zip code",
  "validation": {
    "pattern": "^[0-9]{5}$",
    "message": "Please enter a valid 5-digit zip code"
  }
}
```

**Location in schema_json:**
```
schema_json.repeaterSections.quotedDetails.fields[]
```

## Phase 2.2: Update flattener function

The `flatten_quoted_household_details_enhanced` function must:
1. Extract `zip_code` from the payload
2. Populate `quoted_household_details.zip_code` column

**Current behavior:** Extracts `prospect_name`, `lead_source`, etc. but ignores zip_code

**Required change:** Add zip_code extraction logic

```sql
-- Pseudocode for the update
zip_code := detail_item->>'zip_code';

-- When inserting into quoted_household_details:
INSERT INTO quoted_household_details (..., zip_code, ...)
VALUES (..., zip_code, ...);
```

## Phase 2 Verification

1. Submit a scorecard with quotedDetails including zip code
2. Query `quoted_household_details` and verify `zip_code` column is populated

```sql
SELECT id, household_name, zip_code, created_at
FROM quoted_household_details
ORDER BY created_at DESC
LIMIT 5;
```

---

# PHASE 3: Scorecard → LQS Sync with Deduplication

**Goal:** When scorecard creates `quoted_household_details`, sync to `lqs_households` with dedup

## Phase 3.1: Create sync function

```sql
CREATE OR REPLACE FUNCTION sync_quoted_household_to_lqs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_key text;
  v_first_name text;
  v_last_name text;
  v_existing_id uuid;
BEGIN
  -- Skip if no zip code (can't generate proper key)
  IF NEW.zip_code IS NULL OR NEW.zip_code = '' THEN
    RAISE LOG 'sync_quoted_household_to_lqs: Skipping - no zip_code for detail=%', NEW.id;
    RETURN NEW;
  END IF;

  -- Parse name (assuming format "First Last" in household_name)
  -- Handle edge cases: single name, extra spaces, etc.
  v_first_name := TRIM(SPLIT_PART(NEW.household_name, ' ', 1));
  v_last_name := TRIM(SUBSTRING(NEW.household_name FROM POSITION(' ' IN NEW.household_name) + 1));
  
  -- If no space found, use full name as last name
  IF v_last_name = '' OR v_last_name = v_first_name THEN
    v_last_name := v_first_name;
    v_first_name := 'Unknown';
  END IF;

  -- Generate household_key matching dashboard format
  v_household_key := UPPER(v_last_name) || '_' || UPPER(v_first_name) || '_' || NEW.zip_code;

  RAISE LOG 'sync_quoted_household_to_lqs: Generated key=% for detail=%', v_household_key, NEW.id;

  -- Check if household already exists (dedup)
  SELECT id INTO v_existing_id
  FROM lqs_households
  WHERE agency_id = NEW.agency_id
    AND household_key = v_household_key;

  IF v_existing_id IS NOT NULL THEN
    -- Household exists - update it, no metrics increment needed
    RAISE LOG 'sync_quoted_household_to_lqs: Found existing household=% for key=%', v_existing_id, v_household_key;
    
    UPDATE lqs_households
    SET 
      updated_at = now(),
      -- Optionally update other fields if scorecard has newer info
      notes = COALESCE(notes || E'\n' || 'Updated from scorecard: ' || NEW.id::text, 'From scorecard: ' || NEW.id::text)
    WHERE id = v_existing_id;
    
  ELSE
    -- New household - create with skip flag (scorecard already counted in metrics)
    RAISE LOG 'sync_quoted_household_to_lqs: Creating new household for key=%', v_household_key;
    
    INSERT INTO lqs_households (
      agency_id,
      household_key,
      first_name,
      last_name,
      zip_code,
      status,
      team_member_id,
      first_quote_date,
      lead_source_id,
      skip_metrics_increment  -- IMPORTANT: prevents double-counting
    )
    VALUES (
      NEW.agency_id,
      v_household_key,
      v_first_name,
      v_last_name,
      NEW.zip_code,
      'quoted',
      NEW.team_member_id,
      NEW.work_date,
      NEW.lead_source_id,
      true  -- Skip metrics - scorecard already incremented via upsert_metrics_from_submission
    );
  END IF;

  -- Create lqs_quotes record for tracking
  INSERT INTO lqs_quotes (
    household_id,
    agency_id,
    team_member_id,
    quote_date,
    product_type,
    items_quoted,
    premium_cents,
    source,
    source_reference_id
  )
  SELECT
    COALESCE(v_existing_id, (SELECT id FROM lqs_households WHERE household_key = v_household_key AND agency_id = NEW.agency_id)),
    NEW.agency_id,
    NEW.team_member_id,
    NEW.work_date,
    'Bundle',  -- Default, could be enhanced
    COALESCE(NEW.items_quoted, 1),
    COALESCE(NEW.premium_potential_cents, 0),
    'scorecard',
    NEW.id  -- Reference back to quoted_household_details
  ON CONFLICT DO NOTHING;  -- Prevent duplicate quotes

  RETURN NEW;
END;
$$;
```

## Phase 3.2: Register trigger on quoted_household_details

```sql
DROP TRIGGER IF EXISTS quoted_household_details_sync_to_lqs ON quoted_household_details;

CREATE TRIGGER quoted_household_details_sync_to_lqs
  AFTER INSERT ON quoted_household_details
  FOR EACH ROW
  EXECUTE FUNCTION sync_quoted_household_to_lqs();
```

## Phase 3.3: Add unique constraint for dedup

```sql
-- Ensure we can't have duplicate household_keys per agency
-- (May already exist - check first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'lqs_households_agency_key_unique'
  ) THEN
    ALTER TABLE lqs_households
    ADD CONSTRAINT lqs_households_agency_key_unique 
    UNIQUE (agency_id, household_key);
  END IF;
END $$;
```

## Phase 3 Verification

**Test 1: Scorecard creates new household**
```sql
-- Before: Count households
SELECT COUNT(*) FROM lqs_households WHERE agency_id = '[AGENCY_ID]';

-- Submit scorecard with new quoted household (John Doe, 12345)

-- After: Verify new household created
SELECT id, household_key, skip_metrics_increment, created_at
FROM lqs_households 
WHERE household_key = 'DOE_JOHN_12345';
```

**Test 2: Dashboard then scorecard (dedup)**
```sql
-- 1. Add "Jane Smith, 90210" via dashboard
-- 2. Note metrics_daily.quoted_count

-- 3. Submit scorecard mentioning "Jane Smith, 90210"

-- 4. Verify NO new household created (deduped)
SELECT COUNT(*) FROM lqs_households WHERE household_key = 'SMITH_JANE_90210';
-- Expected: 1

-- 5. Verify metrics_daily.quoted_count did NOT increase again
```

**Test 3: Scorecard then dashboard (dedup)**
```sql
-- 1. Submit scorecard mentioning "Bob Jones, 55555"
-- 2. Note metrics_daily.quoted_count

-- 3. Try to add "Bob Jones, 55555" via dashboard

-- 4. Verify:
--    - No duplicate household created
--    - metrics_daily.quoted_count unchanged
```

---

# Rollback Plan

## Full Rollback (all phases)

```sql
-- Phase 3
DROP TRIGGER IF EXISTS quoted_household_details_sync_to_lqs ON quoted_household_details;
DROP FUNCTION IF EXISTS sync_quoted_household_to_lqs();
ALTER TABLE lqs_households DROP CONSTRAINT IF EXISTS lqs_households_agency_key_unique;

-- Phase 1
DROP TRIGGER IF EXISTS lqs_households_update_metrics ON lqs_households;
DROP FUNCTION IF EXISTS increment_quoted_count_from_lqs();
DROP FUNCTION IF EXISTS increment_metrics_quoted_count(uuid, uuid, date);
ALTER TABLE lqs_households DROP COLUMN IF EXISTS skip_metrics_increment;

-- Phase 2 (form schema) - manual revert required
```

---

# Edge Cases Summary

| Scenario | Expected Behavior |
|----------|-------------------|
| Dashboard quote, no team member | LQS created, no metrics increment |
| Dashboard quote, with team member | LQS created, metrics incremented |
| Scorecard quote, new household | LQS created with skip flag, metrics via existing flow |
| Scorecard quote, household exists in LQS | LQS updated, no metrics change |
| Dashboard quote, household exists from scorecard | LQS updated, no metrics increment (already quoted) |
| Scorecard missing zip code | LQS NOT created, metrics still counted |
| Same household quoted twice same day | Only 1 LQS record, only 1 metrics count |

---

# Files That Need Updates

| File | Phase | Change |
|------|-------|--------|
| Database (SQL migration) | 1, 3 | New functions, triggers, columns |
| Form template schema_json | 2 | Add zip_code field to quotedDetails |
| `flatten_quoted_household_details_enhanced` | 2 | Extract and store zip_code |
| `AddQuoteModal.tsx` | None | Already generates correct household_key |

---

# Implementation Order

1. **Phase 1** → Test → Verify metrics increment from dashboard
2. **Phase 2** → Test → Verify zip code collected and stored
3. **Phase 3** → Test → Verify full dedup works both directions

**DO NOT combine phases.** Each must be verified working before proceeding.

-- Fix: Duplicate lqs_sales records caused by double-write in create_staff_sale
--
-- Bug: create_staff_sale directly inserted into lqs_sales WITHOUT source_reference_id,
-- then sale_policies INSERT trigger (trigger_auto_match_sale_to_lqs) created
-- ADDITIONAL lqs_sales with source_reference_id set. The trigger's guard check
-- only looked at source_reference_id, so it never detected the direct inserts.
--
-- Result: 2x (or more) lqs_sales per policy per household.
--
-- Fix: Deduplicate existing rows, then add a unique index to prevent recurrence.

-- Step 1: Delete duplicate lqs_sales, keeping the "best" record per group.
-- "Best" = the one with source_reference_id set (from trigger), or the earliest created.
DO $$
DECLARE
  deleted_count INT := 0;
  group_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting lqs_sales deduplication...';

  -- Count affected groups first
  SELECT COUNT(*) INTO group_count
  FROM (
    SELECT household_id, sale_date, product_type,
           COALESCE(policy_number, '') AS pn,
           premium_cents
    FROM lqs_sales
    GROUP BY household_id, sale_date, product_type,
             COALESCE(policy_number, ''), premium_cents
    HAVING COUNT(*) > 1
  ) groups;

  RAISE NOTICE 'Found % duplicate groups to clean up', group_count;

  -- Delete duplicates, keeping the row with source_reference_id (preferred)
  -- or the earliest created_at as tiebreaker
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY household_id, sale_date, product_type,
                          COALESCE(policy_number, ''), premium_cents
             ORDER BY
               -- Prefer rows with source_reference_id (links to original sale)
               CASE WHEN source_reference_id IS NOT NULL THEN 0 ELSE 1 END,
               created_at ASC
           ) AS rn
    FROM lqs_sales
  )
  DELETE FROM lqs_sales
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate lqs_sales rows', deleted_count;
END $$;

-- Step 2: Add unique index to prevent future duplicates.
-- Uses COALESCE on policy_number since NULL != NULL in unique constraints.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lqs_sales_no_duplicates
  ON lqs_sales (household_id, sale_date, product_type, premium_cents, COALESCE(policy_number, ''));

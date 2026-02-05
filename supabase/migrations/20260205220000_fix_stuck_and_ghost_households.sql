-- ============================================================================
-- Fix: Stuck households (lead with quotes) and ghost households (lead with no quotes)
--
-- BUG #1: 140+ households stuck at status='lead' despite having quotes.
-- Cause: useQuoteBackgroundUpload uses ignoreDuplicates on quote upsert.
-- When all quotes already exist (re-upload), the upsert returns null,
-- quotesCreatedInGroup stays 0, and the explicit status update is skipped.
-- The DB trigger only fires on INSERT, not skipped duplicates.
--
-- BUG #2: 13+ ghost households created with status='lead' and zero quotes.
-- Cause: Household is upserted BEFORE quotes. If all quote inserts fail
-- or produce no rows (e.g., incomplete data in report), the household
-- persists as an empty ghost record.
--
-- FIX: One-time data correction for all agencies.
-- ============================================================================

-- Step 1: Fix stuck households - promote 'lead' → 'quoted' where quotes exist
DO $$
DECLARE
  v_updated INT;
BEGIN
  WITH stuck_households AS (
    SELECT DISTINCT h.id
    FROM lqs_households h
    INNER JOIN lqs_quotes q ON q.household_id = h.id
    WHERE h.status = 'lead'
  )
  UPDATE lqs_households h
  SET
    status = 'quoted',
    first_quote_date = COALESCE(h.first_quote_date, (
      SELECT MIN(q.quote_date)
      FROM lqs_quotes q
      WHERE q.household_id = h.id
    )),
    updated_at = now()
  FROM stuck_households sh
  WHERE h.id = sh.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Fixed % stuck households: lead → quoted (had quotes but wrong status)', v_updated;
END $$;


-- Step 2: Delete ghost households - status='lead' with zero quotes AND zero sales
-- These are empty records created during quote uploads where no quotes were inserted.
-- All FK references use ON DELETE CASCADE or ON DELETE SET NULL, so this is safe.
DO $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM lqs_households h
  WHERE h.status = 'lead'
    AND NOT EXISTS (
      SELECT 1 FROM lqs_quotes q WHERE q.household_id = h.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM lqs_sales s WHERE s.household_id = h.id
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % ghost households (lead status, no quotes, no sales)', v_deleted;
END $$;

-- ============================================================================
-- Merge Duplicate LQS Households (same name, different zips)
--
-- Problem: Same person imported twice:
--   1. Lead with no zip → EATON_AMY_00000 (bare record)
--   2. Quote with zip → EATON_AMY_16057 (full record)
-- These are treated as separate households but should be merged.
--
-- Strategy:
--   - If one household has 00000 zip and another has a real zip, merge them
--   - Keep the household with the real zip as the target (has more data)
--   - Transfer status, dates, contact_id from source to target if target missing
--   - Delete the source (00000 zip) household after merging
-- ============================================================================

DO $$
DECLARE
  v_merged INT := 0;
  v_rec RECORD;
  v_source lqs_households%ROWTYPE;
BEGIN
  -- Find households with 00000 zip that have a duplicate with a real zip
  FOR v_rec IN (
    SELECT
      h_nozip.id as source_id,
      h_real.id as target_id,
      h_nozip.first_name,
      h_nozip.last_name,
      h_real.zip_code as target_zip
    FROM lqs_households h_nozip
    INNER JOIN lqs_households h_real ON
      h_nozip.agency_id = h_real.agency_id
      AND UPPER(REGEXP_REPLACE(h_nozip.first_name, '[^A-Z]', '', 'gi')) =
          UPPER(REGEXP_REPLACE(h_real.first_name, '[^A-Z]', '', 'gi'))
      AND UPPER(REGEXP_REPLACE(h_nozip.last_name, '[^A-Z]', '', 'gi')) =
          UPPER(REGEXP_REPLACE(h_real.last_name, '[^A-Z]', '', 'gi'))
      AND h_nozip.id != h_real.id
    WHERE (h_nozip.zip_code IS NULL OR h_nozip.zip_code = '' OR h_nozip.zip_code = '00000')
      AND h_real.zip_code IS NOT NULL
      AND h_real.zip_code != ''
      AND h_real.zip_code != '00000'
  )
  LOOP
    -- Get source (no-zip) record
    SELECT * INTO v_source FROM lqs_households WHERE id = v_rec.source_id;

    -- Merge source into target (prefer target values, fill gaps from source)
    UPDATE lqs_households
    SET
      -- Contact info (fill gaps)
      phone = COALESCE(phone, v_source.phone),
      email = COALESCE(email, v_source.email),
      -- Status transitions (prefer more advanced status)
      status = CASE
        WHEN status = 'sold' THEN status
        WHEN v_source.status = 'sold' THEN 'sold'
        WHEN status = 'quoted' THEN status
        WHEN v_source.status = 'quoted' THEN 'quoted'
        ELSE status
      END,
      -- Dates (prefer earlier for received, fill gaps otherwise)
      lead_received_date = LEAST(
        COALESCE(lead_received_date, v_source.lead_received_date),
        v_source.lead_received_date
      ),
      first_quote_date = LEAST(
        COALESCE(first_quote_date, v_source.first_quote_date),
        v_source.first_quote_date
      ),
      sold_date = COALESCE(sold_date, v_source.sold_date),
      -- Attribution (prefer existing, fill gaps)
      lead_source_id = COALESCE(lead_source_id, v_source.lead_source_id),
      team_member_id = COALESCE(team_member_id, v_source.team_member_id),
      -- Content fields
      notes = COALESCE(notes, v_source.notes),
      products_interested = COALESCE(products_interested, v_source.products_interested),
      needs_attention = COALESCE(needs_attention, false) OR COALESCE(v_source.needs_attention, false),
      -- Contact linking
      contact_id = COALESCE(contact_id, v_source.contact_id),
      updated_at = now()
    WHERE id = v_rec.target_id;

    -- lqs_households has no FK references pointing to it, safe to delete
    DELETE FROM lqs_households WHERE id = v_rec.source_id;

    v_merged := v_merged + 1;
    RAISE LOG 'Merged LQS household % (%-zip) into % (%)',
      v_rec.source_id, '00000', v_rec.target_id, v_rec.target_zip;
  END LOOP;

  RAISE NOTICE 'Merged % duplicate LQS households (00000-zip into real-zip)', v_merged;
END $$;


-- Also update the household_key for any 00000 records that now have real zips
-- This can happen if zip was added later via UI but household_key wasn't updated
UPDATE lqs_households
SET
  household_key = UPPER(REGEXP_REPLACE(last_name, '[^A-Z]', '', 'gi')) || '_' ||
                  UPPER(REGEXP_REPLACE(first_name, '[^A-Z]', '', 'gi')) || '_' ||
                  COALESCE(NULLIF(zip_code, ''), '00000'),
  updated_at = now()
WHERE household_key LIKE '%_00000'
  AND zip_code IS NOT NULL
  AND zip_code != ''
  AND zip_code != '00000';


-- Final stats
DO $$
DECLARE
  v_total INT;
  v_with_00000 INT;
  v_potential_dupes INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM lqs_households;
  SELECT COUNT(*) INTO v_with_00000 FROM lqs_households
    WHERE zip_code IS NULL OR zip_code = '' OR zip_code = '00000';

  -- Count potential remaining duplicates (same name, different zips - not including 00000)
  SELECT COUNT(*) INTO v_potential_dupes FROM (
    SELECT agency_id,
           UPPER(REGEXP_REPLACE(first_name, '[^A-Z]', '', 'gi')),
           UPPER(REGEXP_REPLACE(last_name, '[^A-Z]', '', 'gi'))
    FROM lqs_households
    WHERE zip_code IS NOT NULL AND zip_code != '' AND zip_code != '00000'
    GROUP BY 1, 2, 3
    HAVING COUNT(DISTINCT zip_code) > 1
  ) dupes;

  RAISE NOTICE '=== LQS Household Stats ===';
  RAISE NOTICE 'Total households: %', v_total;
  RAISE NOTICE 'With missing/00000 zip: %', v_with_00000;
  RAISE NOTICE 'Potential name dupes with different real zips: %', v_potential_dupes;
END $$;

-- Fix get_contacts_by_stage function:
-- 1. Search now splits on spaces and matches each word against first_name OR last_name
-- 2. Cancel audit now checks for cancel_status = 'Saved' -> returns 'customer' instead of 'cancel_audit'

CREATE OR REPLACE FUNCTION get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  agency_id UUID,
  first_name TEXT,
  last_name TEXT,
  phones TEXT[],
  emails TEXT[],
  household_key TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  computed_stage TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  search_words TEXT[];
BEGIN
  -- Split search string on spaces into array of words
  IF p_search IS NOT NULL AND p_search != '' THEN
    search_words := string_to_array(LOWER(TRIM(p_search)), ' ');
  ELSE
    search_words := NULL;
  END IF;

  RETURN QUERY
  WITH contact_stages AS (
    SELECT
      ac.id,
      ac.agency_id,
      ac.first_name,
      ac.last_name,
      ac.phones,
      ac.emails,
      ac.household_key,
      ac.zip_code,
      ac.created_at,
      ac.updated_at,
      CASE
        -- Priority 1: Active winback (untouched or in_progress)
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'

        -- Priority 2: Cancel audit SAVED = Customer (they paid, account saved)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND LOWER(car.cancel_status) = 'saved'
        ) THEN 'customer'

        -- Priority 3: Cancel audit NOT saved (still in cancel process)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND (car.cancel_status IS NULL OR LOWER(car.cancel_status) NOT IN ('saved'))
        ) THEN 'cancel_audit'

        -- Priority 4: Pending renewal
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'

        -- Priority 5: Customer (sold LQS or successful renewal or won_back)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'sold'
        ) OR EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.current_status = 'success'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status = 'won_back'
        ) THEN 'customer'

        -- Priority 6: Quoted HH (LQS status = quoted)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'quoted'
        ) THEN 'quoted'

        -- Priority 7: Open Lead (LQS status = lead)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'lead'
        ) THEN 'open_lead'

        -- Default: open_lead (fallback for contacts with no linked records)
        ELSE 'open_lead'
      END AS computed_stage
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      AND (
        -- No search term
        search_words IS NULL
        -- OR all search words match first_name or last_name
        OR NOT EXISTS (
          SELECT 1 FROM unnest(search_words) word
          WHERE NOT (
            LOWER(ac.first_name) LIKE '%' || word || '%'
            OR LOWER(ac.last_name) LIKE '%' || word || '%'
          )
        )
        -- OR search matches phone
        OR EXISTS (SELECT 1 FROM unnest(ac.phones) p WHERE p ILIKE '%' || p_search || '%')
        -- OR search matches email
        OR EXISTS (SELECT 1 FROM unnest(ac.emails) e WHERE e ILIKE '%' || p_search || '%')
      )
  ),
  filtered_contacts AS (
    SELECT * FROM contact_stages
    WHERE p_stage IS NULL OR p_stage = 'all' OR computed_stage = p_stage
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered_contacts
  )
  SELECT
    fc.id,
    fc.agency_id,
    fc.first_name,
    fc.last_name,
    fc.phones,
    fc.emails,
    fc.household_key,
    fc.zip_code,
    fc.created_at,
    fc.updated_at,
    fc.computed_stage,
    c.total
  FROM filtered_contacts fc
  CROSS JOIN counted c
  ORDER BY fc.last_name, fc.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_contacts_by_stage TO authenticated;
GRANT EXECUTE ON FUNCTION get_contacts_by_stage TO anon;

COMMENT ON FUNCTION get_contacts_by_stage IS 'Returns contacts filtered by lifecycle stage. Search splits on spaces to match multi-word queries. Cancel audit Saved status returns customer.';

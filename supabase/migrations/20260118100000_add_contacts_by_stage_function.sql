-- Server-side function to get contacts filtered by lifecycle stage
-- This replaces client-side filtering which doesn't scale

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
  current_stage TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Create temp table with contacts and their computed stages
  CREATE TEMP TABLE temp_staged_contacts ON COMMIT DROP AS
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
      -- Compute stage based on priority
      CASE
        -- Priority 1: Active winback
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'

        -- Priority 2: Won back
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status = 'won_back'
        ) THEN 'won_back'

        -- Priority 3: At risk (cancel audit with Cancel status)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND LOWER(car.cancel_status) = 'cancel'
        ) THEN 'at_risk'

        -- Priority 4: Cancelled/Lost (but not saved or won back)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND LOWER(car.cancel_status) IN ('cancelled', 'lost')
        ) AND NOT EXISTS (
          SELECT 1 FROM cancel_audit_records car2
          WHERE car2.contact_id = ac.id
          AND car2.agency_id = p_agency_id
          AND LOWER(car2.cancel_status) = 'saved'
        ) AND NOT EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
        ) THEN 'cancelled'

        -- Priority 5: Pending renewal
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'

        -- Priority 6: Customer (sold LQS, successful renewal, or saved from cancel)
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
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND LOWER(car.cancel_status) = 'saved'
        ) THEN 'customer'

        -- Priority 7: Lead (has LQS record that's not sold)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) IN ('lead', 'quoted')
        ) THEN 'lead'

        -- Default: lead (fallback)
        ELSE 'lead'
      END AS computed_stage
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      -- Apply search filter if provided
      AND (
        p_search IS NULL
        OR p_search = ''
        OR ac.first_name ILIKE '%' || p_search || '%'
        OR ac.last_name ILIKE '%' || p_search || '%'
        OR EXISTS (SELECT 1 FROM unnest(ac.phones) p WHERE p ILIKE '%' || p_search || '%')
        OR EXISTS (SELECT 1 FROM unnest(ac.emails) e WHERE e ILIKE '%' || p_search || '%')
      )
  )
  SELECT * FROM contact_stages
  WHERE p_stage IS NULL OR p_stage = 'all' OR computed_stage = p_stage;

  -- Get total count
  SELECT COUNT(*) INTO v_total FROM temp_staged_contacts;

  -- Return paginated results with total count
  RETURN QUERY
  SELECT
    tsc.id,
    tsc.agency_id,
    tsc.first_name,
    tsc.last_name,
    tsc.phones,
    tsc.emails,
    tsc.household_key,
    tsc.zip_code,
    tsc.created_at,
    tsc.updated_at,
    tsc.computed_stage,
    v_total
  FROM temp_staged_contacts tsc
  ORDER BY tsc.last_name, tsc.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_contacts_by_stage TO authenticated;
GRANT EXECUTE ON FUNCTION get_contacts_by_stage TO anon;

-- Add comment
COMMENT ON FUNCTION get_contacts_by_stage IS 'Returns contacts filtered by lifecycle stage with server-side computation. Handles priority logic for stage determination.';

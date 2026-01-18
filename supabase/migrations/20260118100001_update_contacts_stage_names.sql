-- Update get_contacts_by_stage to use new stage names:
-- open_lead, quoted, customer, renewal, winback, cancel_audit

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
STABLE
AS $$
BEGIN
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

        -- Priority 2: Cancel audit (any cancel status - Cancel, Cancelled, Lost, Saved)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
        ) THEN 'cancel_audit'

        -- Priority 3: Pending renewal
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'

        -- Priority 4: Customer (sold LQS or successful renewal or won_back)
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

        -- Priority 5: Quoted HH (LQS status = quoted)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'quoted'
        ) THEN 'quoted'

        -- Priority 6: Open Lead (LQS status = lead)
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
        p_search IS NULL
        OR p_search = ''
        OR ac.first_name ILIKE '%' || p_search || '%'
        OR ac.last_name ILIKE '%' || p_search || '%'
        OR EXISTS (SELECT 1 FROM unnest(ac.phones) p WHERE p ILIKE '%' || p_search || '%')
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

GRANT EXECUTE ON FUNCTION get_contacts_by_stage TO authenticated;
GRANT EXECUTE ON FUNCTION get_contacts_by_stage TO anon;

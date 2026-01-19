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
) AS $$
DECLARE
  search_words TEXT[];
BEGIN
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
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.agency_id = p_agency_id
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND LOWER(car.cancel_status) = 'saved'
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND (car.cancel_status IS NULL OR LOWER(car.cancel_status) NOT IN ('saved'))
        ) THEN 'cancel_audit'
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'
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
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'quoted'
        ) THEN 'quoted'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id
          AND lqs.agency_id = p_agency_id
          AND LOWER(lqs.status) = 'lead'
        ) THEN 'open_lead'
        ELSE 'open_lead'
      END AS computed_stage
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      AND (
        search_words IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(search_words) word
          WHERE NOT (
            LOWER(ac.first_name) LIKE '%' || word || '%'
            OR LOWER(ac.last_name) LIKE '%' || word || '%'
          )
        )
        OR EXISTS (SELECT 1 FROM unnest(ac.phones) p WHERE p ILIKE '%' || p_search || '%')
        OR EXISTS (SELECT 1 FROM unnest(ac.emails) e WHERE e ILIKE '%' || p_search || '%')
      )
  ),
  filtered_contacts AS (
    SELECT * FROM contact_stages cs
    WHERE p_stage IS NULL OR p_stage = 'all' OR cs.computed_stage = p_stage
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
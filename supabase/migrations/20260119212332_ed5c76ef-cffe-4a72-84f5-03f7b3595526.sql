-- Drop the broken function and recreate with correct logic + new columns
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
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
  last_activity_at TIMESTAMPTZ,
  last_activity_type TEXT,
  assigned_team_member_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_words TEXT[];
BEGIN
  -- Parse search into words for multi-word matching
  IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
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
      -- Compute lifecycle stage with correct priority order
      CASE
        -- Priority 1: Active winback (untouched or in_progress)
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = ac.id 
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        -- Priority 2: Cancel audit with saved status = Customer
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car 
          WHERE car.contact_id = ac.id 
          AND car.is_active = true
          AND LOWER(COALESCE(car.cancel_status, '')) = 'saved'
        ) THEN 'customer'
        -- Priority 3: Cancel audit active (not saved)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car 
          WHERE car.contact_id = ac.id 
          AND car.is_active = true
          AND LOWER(COALESCE(car.cancel_status, '')) <> 'saved'
        ) THEN 'cancel_audit'
        -- Priority 4: Pending renewal
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr 
          WHERE rr.contact_id = ac.id 
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'
        -- Priority 5: Customer (sold from LQS, success renewal, or won_back winback)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs 
          WHERE lqs.contact_id = ac.id AND lqs.status = 'sold'
        ) OR EXISTS (
          SELECT 1 FROM renewal_records rr 
          WHERE rr.contact_id = ac.id AND rr.current_status = 'success'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = ac.id AND wh.status = 'won_back'
        ) THEN 'customer'
        -- Priority 6: Quoted (from LQS)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs 
          WHERE lqs.contact_id = ac.id AND lqs.status = 'quoted'
        ) THEN 'quoted'
        -- Priority 7: Open Lead (from LQS or fallback)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs 
          WHERE lqs.contact_id = ac.id AND lqs.status = 'lead'
        ) THEN 'open_lead'
        -- Default fallback
        ELSE 'open_lead'
      END AS computed_stage,
      -- Last activity timestamp
      (SELECT MAX(ca.created_at) FROM contact_activities ca WHERE ca.contact_id = ac.id) AS last_activity_at,
      -- Last activity type
      (SELECT ca.activity_type FROM contact_activities ca WHERE ca.contact_id = ac.id ORDER BY ca.created_at DESC LIMIT 1) AS last_activity_type,
      -- Assigned team member name based on stage priority
      COALESCE(
        -- Check winback first
        (SELECT tm.name FROM team_members tm 
         JOIN winback_households wh ON wh.assigned_to = tm.id 
         WHERE wh.contact_id = ac.id AND wh.status IN ('untouched', 'in_progress')
         LIMIT 1),
        -- Then cancel audit
        (SELECT tm.name FROM team_members tm 
         JOIN cancel_audit_records car ON car.assigned_team_member_id = tm.id 
         WHERE car.contact_id = ac.id AND car.is_active = true
         LIMIT 1),
        -- Then renewal
        (SELECT tm.name FROM team_members tm 
         JOIN renewal_records rr ON rr.assigned_team_member_id = tm.id 
         WHERE rr.contact_id = ac.id AND rr.is_active = true
         LIMIT 1),
        -- Finally LQS
        (SELECT tm.name FROM team_members tm 
         JOIN lqs_households lqs ON lqs.team_member_id = tm.id 
         WHERE lqs.contact_id = ac.id
         LIMIT 1)
      ) AS assigned_team_member_name
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      -- Multi-word search: ALL words must match first_name OR last_name
      AND (
        search_words IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(search_words) word
          WHERE NOT (
            LOWER(ac.first_name) LIKE '%' || word || '%'
            OR LOWER(ac.last_name) LIKE '%' || word || '%'
          )
        )
        -- Fallback: match phone or email
        OR EXISTS (
          SELECT 1 FROM unnest(ac.phones) phone
          WHERE phone LIKE '%' || REPLACE(p_search, '-', '') || '%'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(ac.emails) email
          WHERE LOWER(email) LIKE '%' || LOWER(p_search) || '%'
        )
      )
  )
  SELECT 
    cs.id,
    cs.agency_id,
    cs.first_name,
    cs.last_name,
    cs.phones,
    cs.emails,
    cs.household_key,
    cs.zip_code,
    cs.created_at,
    cs.updated_at,
    cs.computed_stage,
    cs.last_activity_at,
    cs.last_activity_type,
    cs.assigned_team_member_name,
    COUNT(*) OVER() AS total_count
  FROM contact_stages cs
  WHERE p_stage IS NULL OR cs.computed_stage = p_stage
  ORDER BY cs.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
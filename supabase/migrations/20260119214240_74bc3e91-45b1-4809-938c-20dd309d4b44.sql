-- Phase 3 & 4: Fix get_contacts_by_stage to use activity_date + Backfill historical activities
-- FIXED: Set created_by_staff_id to NULL to avoid FK constraint issues

-- ============================================================
-- PHASE 3: Update get_contacts_by_stage to use activity_date
-- ============================================================

DROP FUNCTION IF EXISTS public.get_contacts_by_stage;

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
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
SET search_path = public
AS $$
DECLARE
  search_words TEXT[];
  total BIGINT;
BEGIN
  -- Split search into words for multi-word matching
  IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
    search_words := string_to_array(LOWER(TRIM(p_search)), ' ');
  ELSE
    search_words := NULL;
  END IF;

  -- Create a temp table with computed stages for efficiency
  CREATE TEMP TABLE temp_contacts ON COMMIT DROP AS
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
        AND wh.status IN ('untouched', 'in_progress')
      ) THEN 'winback'
      -- Priority 2: Cancel audit with saved status = Customer
      WHEN EXISTS (
        SELECT 1 FROM cancel_audit_records car 
        WHERE car.contact_id = ac.id 
        AND LOWER(car.cancel_status) = 'saved'
      ) THEN 'customer'
      -- Priority 3: Active cancel audit (not saved)
      WHEN EXISTS (
        SELECT 1 FROM cancel_audit_records car 
        WHERE car.contact_id = ac.id 
        AND (car.cancel_status IS NULL OR LOWER(car.cancel_status) <> 'saved')
      ) THEN 'cancel_audit'
      -- Priority 4: Pending renewal
      WHEN EXISTS (
        SELECT 1 FROM renewal_records rr 
        WHERE rr.contact_id = ac.id 
        AND rr.current_status IN ('uncontacted', 'pending')
      ) THEN 'renewal'
      -- Priority 5: Customer (sold LQS, successful renewal, or won_back)
      WHEN EXISTS (
        SELECT 1 FROM lqs_households lqs 
        WHERE lqs.contact_id = ac.id 
        AND LOWER(lqs.status) = 'sold'
      ) OR EXISTS (
        SELECT 1 FROM renewal_records rr 
        WHERE rr.contact_id = ac.id 
        AND rr.current_status = 'success'
      ) OR EXISTS (
        SELECT 1 FROM winback_households wh 
        WHERE wh.contact_id = ac.id 
        AND wh.status = 'won_back'
      ) THEN 'customer'
      -- Priority 6: Quoted (LQS quoted or moved_to_quoted winback)
      WHEN EXISTS (
        SELECT 1 FROM lqs_households lqs 
        WHERE lqs.contact_id = ac.id 
        AND LOWER(lqs.status) = 'quoted'
      ) OR EXISTS (
        SELECT 1 FROM winback_households wh 
        WHERE wh.contact_id = ac.id 
        AND wh.status = 'moved_to_quoted'
      ) THEN 'quoted'
      -- Priority 7: Open Lead
      WHEN EXISTS (
        SELECT 1 FROM lqs_households lqs 
        WHERE lqs.contact_id = ac.id 
        AND LOWER(lqs.status) = 'lead'
      ) THEN 'open_lead'
      ELSE 'open_lead'
    END AS computed_stage,
    -- PHASE 3 FIX: Use activity_date instead of created_at for chronological accuracy
    (SELECT MAX(ca.activity_date) FROM contact_activities ca WHERE ca.contact_id = ac.id) AS last_activity_at,
    (SELECT ca.activity_type FROM contact_activities ca WHERE ca.contact_id = ac.id ORDER BY ca.activity_date DESC LIMIT 1) AS last_activity_type,
    -- Assigned team member based on computed stage priority
    COALESCE(
      (SELECT tm.name FROM team_members tm 
       JOIN winback_households wh ON wh.assigned_to = tm.id 
       WHERE wh.contact_id = ac.id AND wh.status IN ('untouched', 'in_progress') LIMIT 1),
      (SELECT tm.name FROM team_members tm 
       JOIN cancel_audit_records car ON car.assigned_team_member_id = tm.id 
       WHERE car.contact_id = ac.id LIMIT 1),
      (SELECT tm.name FROM team_members tm 
       JOIN renewal_records rr ON rr.assigned_team_member_id = tm.id 
       WHERE rr.contact_id = ac.id LIMIT 1),
      (SELECT tm.name FROM team_members tm 
       JOIN lqs_households lqs ON lqs.team_member_id = tm.id 
       WHERE lqs.contact_id = ac.id LIMIT 1)
    ) AS assigned_team_member_name
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
      OR EXISTS (
        SELECT 1 FROM unnest(ac.phones) phone
        WHERE phone LIKE '%' || REPLACE(REPLACE(REPLACE(p_search, '-', ''), '(', ''), ')', '') || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(ac.emails) email
        WHERE LOWER(email) LIKE '%' || LOWER(p_search) || '%'
      )
    );

  -- Filter by stage if provided
  IF p_stage IS NOT NULL THEN
    DELETE FROM temp_contacts WHERE computed_stage <> p_stage;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO total FROM temp_contacts;

  -- Return results
  RETURN QUERY
  SELECT 
    tc.id,
    tc.agency_id,
    tc.first_name,
    tc.last_name,
    tc.phones,
    tc.emails,
    tc.household_key,
    tc.zip_code,
    tc.created_at,
    tc.updated_at,
    tc.computed_stage,
    tc.last_activity_at,
    tc.last_activity_type,
    tc.assigned_team_member_name,
    total
  FROM temp_contacts tc
  ORDER BY tc.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage TO anon;

-- ============================================================
-- PHASE 4: Backfill historical activities into contact_activities
-- NOTE: Set created_by_staff_id to NULL to avoid FK constraint issues
-- (team_member_id is not the same as staff_users.id)
-- ============================================================

-- Backfill from winback_activities (join via household_id -> winback_households -> contact_id)
INSERT INTO contact_activities (
  agency_id,
  contact_id,
  source_module,
  source_record_id,
  activity_type,
  notes,
  activity_date,
  created_by_staff_id,
  created_by_display_name,
  created_at
)
SELECT DISTINCT ON (wa.id)
  wa.agency_id,
  wh.contact_id,
  'winback',
  wa.household_id,
  wa.activity_type,
  wa.notes,
  wa.created_at,
  NULL, -- Set to NULL to avoid FK constraint
  wa.created_by_name,
  wa.created_at
FROM winback_activities wa
JOIN winback_households wh ON wh.id = wa.household_id
WHERE wh.contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contact_activities ca
    WHERE ca.contact_id = wh.contact_id
      AND ca.source_module = 'winback'
      AND ca.source_record_id = wa.household_id
      AND ca.activity_type = wa.activity_type
      AND ca.activity_date = wa.created_at
  );

-- Backfill from cancel_audit_activities (join via record_id -> cancel_audit_records -> contact_id)
INSERT INTO contact_activities (
  agency_id,
  contact_id,
  source_module,
  source_record_id,
  activity_type,
  notes,
  activity_date,
  created_by_staff_id,
  created_by_display_name,
  created_at
)
SELECT DISTINCT ON (caa.id)
  caa.agency_id,
  car.contact_id,
  'cancel_audit',
  caa.record_id,
  caa.activity_type,
  caa.notes,
  caa.created_at,
  NULL, -- Set to NULL to avoid FK constraint
  caa.user_display_name,
  caa.created_at
FROM cancel_audit_activities caa
JOIN cancel_audit_records car ON car.id = caa.record_id
WHERE car.contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contact_activities ca
    WHERE ca.contact_id = car.contact_id
      AND ca.source_module = 'cancel_audit'
      AND ca.source_record_id = caa.record_id
      AND ca.activity_type = caa.activity_type
      AND ca.activity_date = caa.created_at
  );

-- Backfill from renewal_activities (join via renewal_record_id -> renewal_records -> contact_id)
INSERT INTO contact_activities (
  agency_id,
  contact_id,
  source_module,
  source_record_id,
  activity_type,
  notes,
  activity_date,
  created_by_staff_id,
  created_by_display_name,
  created_at
)
SELECT DISTINCT ON (ra.id)
  ra.agency_id,
  rr.contact_id,
  'renewal',
  ra.renewal_record_id,
  ra.activity_type,
  ra.comments,
  ra.created_at,
  NULL, -- Set to NULL to avoid FK constraint
  ra.created_by_display_name,
  ra.created_at
FROM renewal_activities ra
JOIN renewal_records rr ON rr.id = ra.renewal_record_id
WHERE rr.contact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contact_activities ca
    WHERE ca.contact_id = rr.contact_id
      AND ca.source_module = 'renewal'
      AND ca.source_record_id = ra.renewal_record_id
      AND ca.activity_type = ra.activity_type
      AND ca.activity_date = ra.created_at
  );
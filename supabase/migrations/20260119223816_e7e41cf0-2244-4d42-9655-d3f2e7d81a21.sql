-- Drop and recreate get_contacts_by_stage with correct 'lead' status check
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id uuid,
  p_stage text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  phones text[],
  emails text[],
  household_key text,
  current_stage text,
  last_activity_at timestamptz,
  last_activity_type text,
  assigned_team_member_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  search_words text[];
BEGIN
  -- Split search into words for multi-word matching
  IF p_search IS NOT NULL AND p_search <> '' THEN
    search_words := string_to_array(lower(trim(p_search)), ' ');
  END IF;

  RETURN QUERY
  WITH contact_stages AS (
    SELECT 
      c.id,
      c.first_name,
      c.last_name,
      c.phones,
      c.emails,
      c.household_key,
      CASE
        -- Priority 1: Active Winback (untouched or in_progress)
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id 
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        -- Priority 2: Customer (has sale)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          JOIN lqs_sales ls ON ls.household_id = lh.id
          WHERE lh.contact_id = c.id
        ) THEN 'customer'
        -- Priority 3: Cancel Audit (active record)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = c.id AND car.is_active = true
        ) THEN 'cancel_audit'
        -- Priority 4: Renewal
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          WHERE lh.contact_id = c.id AND lh.status = 'renewal'
        ) THEN 'renewal'
        -- Priority 5: Quoted (has quote, no sale)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          JOIN lqs_quotes lq ON lq.household_id = lh.id
          WHERE lh.contact_id = c.id
        ) THEN 'quoted'
        -- Priority 6: Open Lead (status = 'lead')
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          WHERE lh.contact_id = c.id AND lh.status = 'lead'
        ) THEN 'open_lead'
        ELSE 'unknown'
      END AS computed_stage,
      -- Get last activity date
      (
        SELECT MAX(activity_date)
        FROM (
          SELECT ca.activity_date FROM contact_activities ca WHERE ca.contact_id = c.id
          UNION ALL
          SELECT caa.created_at FROM cancel_audit_activities caa WHERE caa.household_key = c.household_key AND caa.agency_id = c.agency_id
          UNION ALL
          SELECT wa.created_at FROM winback_activities wa 
          JOIN winback_households wh ON wh.id = wa.household_id 
          WHERE wh.contact_id = c.id
        ) activities
      ) AS last_activity_at,
      -- Get last activity type
      (
        SELECT activity_type
        FROM (
          SELECT ca.activity_date as dt, ca.activity_type FROM contact_activities ca WHERE ca.contact_id = c.id
          UNION ALL
          SELECT caa.created_at as dt, caa.activity_type FROM cancel_audit_activities caa WHERE caa.household_key = c.household_key AND caa.agency_id = c.agency_id
          UNION ALL
          SELECT wa.created_at as dt, wa.activity_type FROM winback_activities wa 
          JOIN winback_households wh ON wh.id = wa.household_id 
          WHERE wh.contact_id = c.id
        ) activities
        ORDER BY dt DESC
        LIMIT 1
      ) AS last_activity_type,
      -- Get assigned team member name based on stage
      (
        SELECT tm.name
        FROM team_members tm
        WHERE tm.id = COALESCE(
          -- Check winback first
          (SELECT wh.assigned_to FROM winback_households wh WHERE wh.contact_id = c.id AND wh.status IN ('untouched', 'in_progress') LIMIT 1),
          -- Then cancel audit
          (SELECT car.assigned_team_member_id FROM cancel_audit_records car WHERE car.contact_id = c.id AND car.is_active = true LIMIT 1),
          -- Then LQS household
          (SELECT lh.team_member_id FROM lqs_households lh WHERE lh.contact_id = c.id LIMIT 1)
        )
      ) AS assigned_team_member_name
    FROM agency_contacts c
    WHERE c.agency_id = p_agency_id
  )
  SELECT 
    cs.id,
    cs.first_name,
    cs.last_name,
    cs.phones,
    cs.emails,
    cs.household_key,
    cs.computed_stage,
    cs.last_activity_at,
    cs.last_activity_type,
    cs.assigned_team_member_name
  FROM contact_stages cs
  WHERE 
    -- Stage filter
    (p_stage IS NULL OR cs.computed_stage = p_stage)
    -- Search filter (multi-word: all words must match first_name or last_name)
    AND (
      search_words IS NULL 
      OR (
        -- Check if all words match either first or last name
        (
          SELECT bool_and(
            lower(cs.first_name) LIKE '%' || word || '%' 
            OR lower(cs.last_name) LIKE '%' || word || '%'
          )
          FROM unnest(search_words) AS word
        )
      )
      -- Fallback to phone/email search
      OR EXISTS (
        SELECT 1 FROM unnest(cs.phones) AS phone 
        WHERE phone ILIKE '%' || p_search || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(cs.emails) AS email 
        WHERE email ILIKE '%' || p_search || '%'
      )
    )
  ORDER BY cs.last_activity_at DESC NULLS LAST, cs.last_name, cs.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
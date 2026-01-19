
-- Fix ambiguous column reference in get_contacts_by_stage
-- The computed_stage column needs to be qualified with the CTE alias

DROP FUNCTION IF EXISTS public.get_contacts_by_stage(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id uuid,
  p_stage text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  agency_id uuid,
  first_name text,
  last_name text,
  phones text[],
  emails text[],
  household_key text,
  zip_code text,
  created_at timestamptz,
  updated_at timestamptz,
  computed_stage text,
  total_count bigint,
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
    search_words := string_to_array(upper(trim(p_search)), ' ');
  END IF;

  RETURN QUERY
  WITH contact_data AS (
    SELECT
      c.id,
      c.agency_id,
      c.first_name,
      c.last_name,
      c.phones,
      c.emails,
      c.household_key,
      c.zip_code,
      c.created_at,
      c.updated_at,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = c.id AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          JOIN lqs_sales ls ON ls.household_id = lh.id
          WHERE lh.contact_id = c.id
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = c.id AND car.is_active = true
        ) THEN 'cancel_audit'
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = c.id AND rr.is_active = true
        ) THEN 'renewal'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          WHERE lh.contact_id = c.id AND lh.status = 'quoted'
        ) THEN 'quoted'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          WHERE lh.contact_id = c.id AND lh.status = 'open'
        ) THEN 'open_lead'
        ELSE 'unknown'
      END AS stage,
      -- Get last activity from contact_activities using activity_date
      (
        SELECT MAX(ca.activity_date)
        FROM contact_activities ca
        WHERE ca.contact_id = c.id
      ) AS last_activity,
      (
        SELECT ca.activity_type
        FROM contact_activities ca
        WHERE ca.contact_id = c.id
        ORDER BY ca.activity_date DESC
        LIMIT 1
      ) AS last_activity_kind,
      -- Get assigned team member name based on stage priority
      COALESCE(
        (SELECT tm.name FROM winback_households wh
         JOIN team_members tm ON tm.id = wh.assigned_to
         WHERE wh.contact_id = c.id AND wh.status IN ('untouched', 'in_progress')
         LIMIT 1),
        (SELECT tm.name FROM cancel_audit_records car
         JOIN team_members tm ON tm.id = car.assigned_team_member_id
         WHERE car.contact_id = c.id AND car.is_active = true
         LIMIT 1),
        (SELECT tm.name FROM renewal_records rr
         JOIN team_members tm ON tm.id = rr.assigned_team_member_id
         WHERE rr.contact_id = c.id AND rr.is_active = true
         LIMIT 1),
        (SELECT tm.name FROM lqs_households lh
         JOIN team_members tm ON tm.id = lh.team_member_id
         WHERE lh.contact_id = c.id
         LIMIT 1)
      ) AS assigned_name
    FROM agency_contacts c
    WHERE c.agency_id = p_agency_id
      AND (
        p_search IS NULL 
        OR p_search = ''
        OR (
          search_words IS NOT NULL 
          AND (
            SELECT bool_and(
              c.first_name ILIKE '%' || word || '%' 
              OR c.last_name ILIKE '%' || word || '%'
            )
            FROM unnest(search_words) AS word
          )
        )
        OR EXISTS (SELECT 1 FROM unnest(c.phones) ph WHERE ph ILIKE '%' || p_search || '%')
        OR EXISTS (SELECT 1 FROM unnest(c.emails) em WHERE em ILIKE '%' || p_search || '%')
      )
  )
  SELECT
    cd.id,
    cd.agency_id,
    cd.first_name,
    cd.last_name,
    cd.phones,
    cd.emails,
    cd.household_key,
    cd.zip_code,
    cd.created_at,
    cd.updated_at,
    cd.stage AS computed_stage,
    COUNT(*) OVER()::bigint AS total_count,
    cd.last_activity AS last_activity_at,
    cd.last_activity_kind AS last_activity_type,
    cd.assigned_name AS assigned_team_member_name
  FROM contact_data cd
  WHERE (p_stage IS NULL OR cd.stage = p_stage)
  ORDER BY cd.last_name, cd.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

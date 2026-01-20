-- Fix: Replace non-existent wh.assigned_team_member_id with wh.assigned_to
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(uuid, text, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id uuid,
  p_stage text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_cursor text DEFAULT NULL,
  p_sort text DEFAULT 'name_asc'
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phones text[],
  emails text[],
  household_key text,
  current_stage text,
  last_activity_at timestamptz,
  last_activity_type text,
  assigned_team_member_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor_name text;
  v_cursor_id uuid;
BEGIN
  -- Parse cursor if provided
  IF p_cursor IS NOT NULL AND p_cursor != '' THEN
    v_cursor_name := split_part(p_cursor, ':', 1);
    v_cursor_id := split_part(p_cursor, ':', 2)::uuid;
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
      -- Stage classification aligned with frontend determineLifecycleStage
      CASE
        -- Winback: active winback record
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id 
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        -- Customer: has sale, successful renewal, won_back winback, or saved cancel
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh 
          WHERE lh.contact_id = c.id AND lh.status = 'sold'
        ) OR EXISTS (
          SELECT 1 FROM renewal_records rr 
          WHERE rr.contact_id = c.id AND rr.is_active = true AND rr.current_status = 'success'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id AND wh.status = 'won_back'
        ) OR EXISTS (
          SELECT 1 FROM cancel_audit_records car 
          WHERE car.contact_id = c.id AND car.is_active = true AND car.cancel_status = 'Saved'
        ) THEN 'customer'
        -- Cancel Audit: active record NOT saved
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car 
          WHERE car.contact_id = c.id 
          AND car.is_active = true 
          AND (car.cancel_status IS NULL OR car.cancel_status NOT IN ('Saved'))
        ) THEN 'cancel_audit'
        -- Renewal: only uncontacted/pending (not unsuccessful/success)
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr 
          WHERE rr.contact_id = c.id 
          AND rr.is_active = true 
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'
        -- Quoted: has quote or winback moved to quoted
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh 
          WHERE lh.contact_id = c.id AND lh.status = 'quoted'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id AND wh.status = 'moved_to_quoted'
        ) THEN 'quoted'
        -- Open Lead: LQS status = 'lead'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh 
          WHERE lh.contact_id = c.id AND lh.status = 'lead'
        ) THEN 'open_lead'
        -- Default fallback: open_lead (never unknown)
        ELSE 'open_lead'
      END as current_stage,
      -- Last activity
      (SELECT ca.activity_date FROM contact_activities ca 
       WHERE ca.contact_id = c.id ORDER BY ca.activity_date DESC LIMIT 1) as last_activity_at,
      (SELECT ca.activity_type FROM contact_activities ca 
       WHERE ca.contact_id = c.id ORDER BY ca.activity_date DESC LIMIT 1) as last_activity_type,
      -- Assigned team member based on stage priority
      COALESCE(
        -- Winback: uses assigned_to column directly (stores name, not FK)
        (SELECT wh.assigned_to FROM winback_households wh 
         WHERE wh.contact_id = c.id AND wh.status IN ('untouched', 'in_progress') 
         LIMIT 1),
        -- Cancel audit
        (SELECT tm.name FROM cancel_audit_records car 
         JOIN team_members tm ON car.assigned_team_member_id = tm.id 
         WHERE car.contact_id = c.id AND car.is_active = true 
         LIMIT 1),
        -- Renewal
        (SELECT tm.name FROM renewal_records rr 
         JOIN team_members tm ON rr.assigned_team_member_id = tm.id 
         WHERE rr.contact_id = c.id AND rr.is_active = true 
         LIMIT 1),
        -- LQS
        (SELECT tm.name FROM lqs_households lh 
         JOIN team_members tm ON lh.team_member_id = tm.id 
         WHERE lh.contact_id = c.id 
         LIMIT 1)
      ) as assigned_team_member_name
    FROM agency_contacts c
    WHERE c.agency_id = p_agency_id
  ),
  filtered AS (
    SELECT cs.*
    FROM contact_stages cs
    WHERE 
      -- Stage filter
      (p_stage IS NULL OR p_stage = '' OR p_stage = 'all' OR cs.current_stage = p_stage)
      -- Search filter (multi-word name matching or phone/email)
      AND (
        p_search IS NULL OR p_search = '' OR
        (
          -- Multi-word name search: all words must match first_name or last_name
          (SELECT bool_and(
            lower(cs.first_name) LIKE '%' || lower(word) || '%' 
            OR lower(cs.last_name) LIKE '%' || lower(word) || '%'
          ) FROM unnest(string_to_array(trim(p_search), ' ')) AS word)
        )
        OR EXISTS (SELECT 1 FROM unnest(cs.phones) p WHERE p ILIKE '%' || p_search || '%')
        OR EXISTS (SELECT 1 FROM unnest(cs.emails) e WHERE e ILIKE '%' || p_search || '%')
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER() as total_count
    FROM filtered f
  ),
  sorted AS (
    SELECT *
    FROM counted
    ORDER BY
      CASE WHEN p_sort = 'name_asc' THEN (first_name || ' ' || last_name) END ASC,
      CASE WHEN p_sort = 'name_desc' THEN (first_name || ' ' || last_name) END DESC,
      CASE WHEN p_sort = 'activity_desc' THEN last_activity_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'activity_asc' THEN last_activity_at END ASC NULLS LAST,
      first_name ASC, id ASC
  )
  SELECT 
    s.id,
    s.first_name,
    s.last_name,
    s.phones,
    s.emails,
    s.household_key,
    s.current_stage,
    s.last_activity_at,
    s.last_activity_type,
    s.assigned_team_member_name,
    s.total_count
  FROM sorted s
  WHERE 
    -- Cursor-based pagination
    (v_cursor_name IS NULL OR v_cursor_id IS NULL) 
    OR ((s.first_name || ' ' || s.last_name), s.id) > (v_cursor_name, v_cursor_id)
  LIMIT p_limit;
END;
$$;
-- Fix: Use wh.assigned_to directly instead of non-existent assigned_team_member_id column
CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'last_name',
  p_sort_order TEXT DEFAULT 'asc',
  p_cursor_id UUID DEFAULT NULL,
  p_cursor_value TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  first_name TEXT,
  last_name TEXT,
  phones TEXT[],
  emails TEXT[],
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  household_key TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  current_stage TEXT,
  assigned_team_member TEXT,
  last_activity_date TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort_column TEXT;
  v_sort_direction TEXT;
BEGIN
  -- Validate and set sort parameters
  v_sort_column := CASE 
    WHEN p_sort_by IN ('first_name', 'last_name', 'created_at', 'updated_at') THEN p_sort_by
    ELSE 'last_name'
  END;
  
  v_sort_direction := CASE 
    WHEN LOWER(p_sort_order) = 'desc' THEN 'DESC'
    ELSE 'ASC'
  END;

  RETURN QUERY
  WITH contact_stages AS (
    SELECT 
      c.id,
      c.first_name,
      c.last_name,
      c.phones,
      c.emails,
      c.street_address,
      c.city,
      c.state,
      c.zip_code,
      c.household_key,
      c.created_at,
      c.updated_at,
      -- Compute stage with priority
      CASE
        -- 1. Winback (active)
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id 
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        -- 2. Cancel Audit (active, not saved)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car 
          WHERE car.contact_id = c.id 
          AND car.is_active = true 
          AND car.status != 'Saved'
        ) THEN 'cancel_audit'
        -- 3. Customer (has sale, successful renewal, won winback, or saved cancel)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh 
          WHERE lh.contact_id = c.id AND lh.status = 'sale'
        ) OR EXISTS (
          SELECT 1 FROM renewal_households rh 
          WHERE rh.contact_id = c.id AND rh.current_status = 'success'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id AND wh.status = 'won'
        ) OR EXISTS (
          SELECT 1 FROM cancel_audit_records car 
          WHERE car.contact_id = c.id AND car.status = 'Saved'
        ) THEN 'customer'
        -- 4. Renewal (active, uncontacted or pending only)
        WHEN EXISTS (
          SELECT 1 FROM renewal_households rh 
          WHERE rh.contact_id = c.id 
          AND rh.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'
        -- 5. Quoted
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh 
          WHERE lh.contact_id = c.id AND lh.status = 'quoted'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh 
          WHERE wh.contact_id = c.id AND wh.status = 'quoted'
        ) THEN 'quoted'
        -- 6. Open Lead
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh 
          WHERE lh.contact_id = c.id AND lh.status = 'lead'
        ) THEN 'open_lead'
        -- Default to open_lead (eliminates unknown)
        ELSE 'open_lead'
      END AS computed_stage,
      -- Get assigned team member (check each module) - FIXED: use assigned_to directly for winback
      COALESCE(
        (SELECT wh.assigned_to FROM winback_households wh 
         WHERE wh.contact_id = c.id AND wh.status IN ('untouched', 'in_progress') 
         LIMIT 1),
        (SELECT tm.name FROM cancel_audit_records car 
         JOIN team_members tm ON car.assigned_team_member_id = tm.id 
         WHERE car.contact_id = c.id AND car.is_active = true 
         LIMIT 1),
        (SELECT tm.name FROM renewal_households rh 
         JOIN team_members tm ON rh.assigned_team_member_id = tm.id 
         WHERE rh.contact_id = c.id 
         LIMIT 1),
        (SELECT tm.name FROM lqs_households lh 
         JOIN team_members tm ON lh.assigned_team_member_id = tm.id 
         WHERE lh.contact_id = c.id 
         LIMIT 1)
      ) AS assigned_team_member,
      -- Get last activity date
      (SELECT MAX(ca.activity_date) FROM contact_activities ca WHERE ca.contact_id = c.id) AS last_activity_date
    FROM agency_contacts c
    WHERE c.agency_id = p_agency_id
      AND (
        p_search IS NULL 
        OR p_search = ''
        OR c.first_name ILIKE '%' || p_search || '%'
        OR c.last_name ILIKE '%' || p_search || '%'
        OR EXISTS (SELECT 1 FROM unnest(c.phones) AS phone WHERE phone ILIKE '%' || p_search || '%')
        OR EXISTS (SELECT 1 FROM unnest(c.emails) AS email WHERE email ILIKE '%' || p_search || '%')
      )
  )
  SELECT 
    cs.id,
    cs.first_name,
    cs.last_name,
    cs.phones,
    cs.emails,
    cs.street_address,
    cs.city,
    cs.state,
    cs.zip_code,
    cs.household_key,
    cs.created_at,
    cs.updated_at,
    cs.computed_stage AS current_stage,
    cs.assigned_team_member,
    cs.last_activity_date,
    COUNT(*) OVER() AS total_count
  FROM contact_stages cs
  WHERE (p_stage IS NULL OR p_stage = '' OR p_stage = 'all' OR cs.computed_stage = p_stage)
  ORDER BY
    CASE WHEN v_sort_direction = 'ASC' THEN
      CASE v_sort_column
        WHEN 'first_name' THEN cs.first_name
        WHEN 'last_name' THEN cs.last_name
        ELSE NULL
      END
    END ASC NULLS LAST,
    CASE WHEN v_sort_direction = 'DESC' THEN
      CASE v_sort_column
        WHEN 'first_name' THEN cs.first_name
        WHEN 'last_name' THEN cs.last_name
        ELSE NULL
      END
    END DESC NULLS LAST,
    CASE WHEN v_sort_direction = 'ASC' AND v_sort_column IN ('created_at', 'updated_at') THEN
      CASE v_sort_column
        WHEN 'created_at' THEN cs.created_at
        WHEN 'updated_at' THEN cs.updated_at
        ELSE NULL
      END
    END ASC NULLS LAST,
    CASE WHEN v_sort_direction = 'DESC' AND v_sort_column IN ('created_at', 'updated_at') THEN
      CASE v_sort_column
        WHEN 'created_at' THEN cs.created_at
        WHEN 'updated_at' THEN cs.updated_at
        ELSE NULL
      END
    END DESC NULLS LAST,
    cs.id
  LIMIT p_limit;
END;
$$;
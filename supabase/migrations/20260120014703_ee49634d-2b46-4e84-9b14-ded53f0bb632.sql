-- Fix get_contacts_by_stage: join renewal/cancel_audit by contact_id and align stage classification
CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_sort_by TEXT DEFAULT 'name',
  p_sort_direction TEXT DEFAULT 'asc'
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
  total BIGINT;
BEGIN
  WITH filtered_contacts AS (
    SELECT DISTINCT ac.id
    FROM agency_contacts ac
    LEFT JOIN lqs_households lh
      ON lh.agency_id = ac.agency_id
     AND lh.household_key = ac.household_key
    LEFT JOIN winback_households wh
      ON wh.agency_id = ac.agency_id
     AND wh.contact_id = ac.id
    LEFT JOIN renewal_records rr
      ON rr.agency_id = ac.agency_id
     AND rr.contact_id = ac.id
     AND rr.is_active = true
    LEFT JOIN cancel_audit_records car
      ON car.agency_id = ac.agency_id
     AND car.contact_id = ac.id
     AND car.is_active = true
    WHERE ac.agency_id = p_agency_id
      AND (p_search IS NULL OR p_search = '' OR (
        ac.first_name ILIKE '%' || p_search || '%' OR
        ac.last_name ILIKE '%' || p_search || '%' OR
        (ac.first_name || ' ' || ac.last_name) ILIKE '%' || p_search || '%' OR
        EXISTS (SELECT 1 FROM unnest(ac.phones) AS phone WHERE phone ILIKE '%' || p_search || '%') OR
        EXISTS (SELECT 1 FROM unnest(ac.emails) AS email WHERE email ILIKE '%' || p_search || '%')
      ))
      AND (p_stage IS NULL OR p_stage = '' OR
        CASE
          -- Stage priority: Winback -> Customer -> Cancel Audit -> Renewal -> Quoted -> Open Lead
          WHEN wh.id IS NOT NULL AND lower(wh.status) IN ('untouched','in_progress') THEN 'winback'
          WHEN (
            (wh.id IS NOT NULL AND lower(wh.status) IN ('won_back','won')) OR
            (rr.id IS NOT NULL AND lower(rr.current_status) = 'success') OR
            (car.id IS NOT NULL AND lower(car.status) IN ('saved','resolved')) OR
            (lh.id IS NOT NULL AND lower(lh.status) = 'sold')
          ) THEN 'customer'
          WHEN car.id IS NOT NULL AND lower(car.status) IN ('new','in_progress') THEN 'cancel_audit'
          WHEN rr.id IS NOT NULL AND lower(rr.current_status) IN ('uncontacted','pending') THEN 'renewal'
          WHEN lh.id IS NOT NULL AND lower(lh.status) = 'quoted' THEN 'quoted'
          WHEN lh.id IS NOT NULL AND lower(lh.status) = 'lead' THEN 'open_lead'
          ELSE 'open_lead'
        END = p_stage
      )
  )
  SELECT COUNT(*) INTO total FROM filtered_contacts;

  RETURN QUERY
  WITH contact_data AS (
    SELECT DISTINCT ON (ac.id)
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
        WHEN wh.id IS NOT NULL AND lower(wh.status) IN ('untouched','in_progress') THEN 'winback'
        WHEN (
          (wh.id IS NOT NULL AND lower(wh.status) IN ('won_back','won')) OR
          (rr.id IS NOT NULL AND lower(rr.current_status) = 'success') OR
          (car.id IS NOT NULL AND lower(car.status) IN ('saved','resolved')) OR
          (lh.id IS NOT NULL AND lower(lh.status) = 'sold')
        ) THEN 'customer'
        WHEN car.id IS NOT NULL AND lower(car.status) IN ('new','in_progress') THEN 'cancel_audit'
        WHEN rr.id IS NOT NULL AND lower(rr.current_status) IN ('uncontacted','pending') THEN 'renewal'
        WHEN lh.id IS NOT NULL AND lower(lh.status) = 'quoted' THEN 'quoted'
        WHEN lh.id IS NOT NULL AND lower(lh.status) = 'lead' THEN 'open_lead'
        ELSE 'open_lead'
      END AS computed_stage,
      (
        SELECT MAX(ca.activity_date)
        FROM contact_activities ca
        WHERE ca.contact_id = ac.id
      ) AS last_activity_at,
      (
        SELECT ca.activity_type
        FROM contact_activities ca
        WHERE ca.contact_id = ac.id
        ORDER BY ca.activity_date DESC
        LIMIT 1
      ) AS last_activity_type,
      COALESCE(
        (SELECT tm.name FROM team_members tm WHERE tm.id = wh.assigned_to),
        (SELECT tm.name FROM team_members tm WHERE tm.id = rr.assigned_team_member_id),
        (SELECT tm.name FROM team_members tm WHERE tm.id = car.assigned_team_member_id),
        (SELECT tm.name FROM team_members tm WHERE tm.id = lh.team_member_id)
      ) AS assigned_team_member_name
    FROM agency_contacts ac
    LEFT JOIN lqs_households lh
      ON lh.agency_id = ac.agency_id
     AND lh.household_key = ac.household_key
    LEFT JOIN winback_households wh
      ON wh.agency_id = ac.agency_id
     AND wh.contact_id = ac.id
    LEFT JOIN renewal_records rr
      ON rr.agency_id = ac.agency_id
     AND rr.contact_id = ac.id
     AND rr.is_active = true
    LEFT JOIN cancel_audit_records car
      ON car.agency_id = ac.agency_id
     AND car.contact_id = ac.id
     AND car.is_active = true
    WHERE ac.agency_id = p_agency_id
      AND (p_search IS NULL OR p_search = '' OR (
        ac.first_name ILIKE '%' || p_search || '%' OR
        ac.last_name ILIKE '%' || p_search || '%' OR
        (ac.first_name || ' ' || ac.last_name) ILIKE '%' || p_search || '%' OR
        EXISTS (SELECT 1 FROM unnest(ac.phones) AS phone WHERE phone ILIKE '%' || p_search || '%') OR
        EXISTS (SELECT 1 FROM unnest(ac.emails) AS email WHERE email ILIKE '%' || p_search || '%')
      ))
      AND (p_stage IS NULL OR p_stage = '' OR
        CASE
          WHEN wh.id IS NOT NULL AND lower(wh.status) IN ('untouched','in_progress') THEN 'winback'
          WHEN (
            (wh.id IS NOT NULL AND lower(wh.status) IN ('won_back','won')) OR
            (rr.id IS NOT NULL AND lower(rr.current_status) = 'success') OR
            (car.id IS NOT NULL AND lower(car.status) IN ('saved','resolved')) OR
            (lh.id IS NOT NULL AND lower(lh.status) = 'sold')
          ) THEN 'customer'
          WHEN car.id IS NOT NULL AND lower(car.status) IN ('new','in_progress') THEN 'cancel_audit'
          WHEN rr.id IS NOT NULL AND lower(rr.current_status) IN ('uncontacted','pending') THEN 'renewal'
          WHEN lh.id IS NOT NULL AND lower(lh.status) = 'quoted' THEN 'quoted'
          WHEN lh.id IS NOT NULL AND lower(lh.status) = 'lead' THEN 'open_lead'
          ELSE 'open_lead'
        END = p_stage
      )
    ORDER BY ac.id
  )
  SELECT
    f.id,
    f.agency_id,
    f.first_name,
    f.last_name,
    f.phones,
    f.emails,
    f.household_key,
    f.zip_code,
    f.created_at,
    f.updated_at,
    f.computed_stage AS current_stage,
    f.computed_stage,
    f.last_activity_at,
    f.last_activity_type,
    f.assigned_team_member_name,
    total AS total_count
  FROM contact_data f
  ORDER BY
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'asc' THEN f.last_name END ASC,
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'asc' THEN f.first_name END ASC,
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'desc' THEN f.last_name END DESC,
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'desc' THEN f.first_name END DESC,
    CASE WHEN p_sort_by = 'last_activity' AND p_sort_direction = 'asc' THEN f.last_activity_at END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_activity' AND p_sort_direction = 'desc' THEN f.last_activity_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'status' AND p_sort_direction = 'asc' THEN f.computed_stage END ASC,
    CASE WHEN p_sort_by = 'status' AND p_sort_direction = 'desc' THEN f.computed_stage END DESC,
    CASE WHEN p_sort_by = 'assigned' AND p_sort_direction = 'asc' THEN f.assigned_team_member_name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'assigned' AND p_sort_direction = 'desc' THEN f.assigned_team_member_name END DESC NULLS LAST,
    f.last_name ASC, f.first_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
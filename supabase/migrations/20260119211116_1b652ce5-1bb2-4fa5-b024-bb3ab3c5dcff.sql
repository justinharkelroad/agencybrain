-- Drop and recreate get_contacts_by_stage to include last activity data
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
  last_activity_at timestamptz,
  last_activity_type text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        WHEN EXISTS (
          SELECT 1 FROM sales s WHERE s.contact_id = ac.id AND s.status = 'issued'
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM sales s WHERE s.contact_id = ac.id AND s.status IN ('pending', 'submitted')
        ) THEN 'sold'
        WHEN EXISTS (
          SELECT 1 FROM sales s WHERE s.contact_id = ac.id
        ) THEN 'quoted'
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh WHERE wh.contact_id = ac.id
        ) THEN 'winback'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car WHERE car.contact_id = ac.id
        ) THEN 'at_risk'
        ELSE 'lead'
      END AS computed_stage,
      (
        SELECT MAX(ca.created_at) 
        FROM contact_activities ca 
        WHERE ca.contact_id = ac.id
      ) AS last_activity_at,
      (
        SELECT ca.activity_type 
        FROM contact_activities ca 
        WHERE ca.contact_id = ac.id 
        ORDER BY ca.created_at DESC 
        LIMIT 1
      ) AS last_activity_type
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      AND (
        p_search IS NULL 
        OR ac.first_name ILIKE '%' || p_search || '%'
        OR ac.last_name ILIKE '%' || p_search || '%'
        OR ac.household_key ILIKE '%' || p_search || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(ac.phones) AS phone WHERE phone ILIKE '%' || p_search || '%'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(ac.emails) AS email WHERE email ILIKE '%' || p_search || '%'
        )
      )
  ),
  filtered_contacts AS (
    SELECT cs.*
    FROM contact_stages cs
    WHERE p_stage IS NULL OR cs.computed_stage = p_stage
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM filtered_contacts
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
    fc.last_activity_at,
    fc.last_activity_type,
    t.cnt AS total_count
  FROM filtered_contacts fc
  CROSS JOIN total t
  ORDER BY fc.last_name, fc.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
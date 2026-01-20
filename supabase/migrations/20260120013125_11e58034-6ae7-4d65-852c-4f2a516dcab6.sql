-- Fix Contacts RPC further: winback assigned_to is a UUID; lqs_households uses team_member_id
CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id uuid,
  p_stage text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 100,
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
  last_activity_at timestamp with time zone,
  last_activity_type text,
  assigned_team_member_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        -- 1. Winback (active status)
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = c.id 
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        
        -- 2. Cancel Audit (active, NOT saved - saved = customer)
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = c.id 
          AND car.is_active = true
          AND (car.cancel_status IS NULL OR lower(car.cancel_status) NOT IN ('saved'))
        ) THEN 'cancel_audit'
        
        -- 3. Renewal (only uncontacted/pending - success/unsuccessful are not "renewal" stage)
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = c.id 
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'
        
        -- 4. Customer (has sale, OR successful renewal, OR won_back winback, OR saved cancel)
        WHEN EXISTS (
          SELECT 1 FROM lqs_sales ls
          JOIN lqs_households lh ON ls.household_id = lh.id
          WHERE lh.contact_id = c.id
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = c.id 
          AND rr.current_status = 'success'
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = c.id 
          AND wh.status = 'won_back'
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = c.id 
          AND lower(car.cancel_status) = 'saved'
        ) THEN 'customer'
        
        -- 5. Quoted (has quote OR winback moved to quoted)
        WHEN EXISTS (
          SELECT 1 FROM lqs_quotes lq
          JOIN lqs_households lh ON lq.household_id = lh.id
          WHERE lh.contact_id = c.id
        ) THEN 'quoted'
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = c.id 
          AND wh.status = 'moved_to_quoted'
        ) THEN 'quoted'
        
        -- 6. Open Lead (LQS household with lead status)
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lh
          WHERE lh.contact_id = c.id 
          AND lh.status = 'lead'
        ) THEN 'open_lead'
        
        -- 7. FALLBACK: open_lead (never "unknown")
        ELSE 'open_lead'
      END AS computed_stage,
      
      -- Get last activity
      (
        SELECT ca.activity_date 
        FROM contact_activities ca 
        WHERE ca.contact_id = c.id 
        ORDER BY ca.activity_date DESC 
        LIMIT 1
      ) AS last_activity_at,
      (
        SELECT ca.activity_type 
        FROM contact_activities ca 
        WHERE ca.contact_id = c.id 
        ORDER BY ca.activity_date DESC 
        LIMIT 1
      ) AS last_activity_type,
      
      -- Get assigned team member name based on stage priority
      COALESCE(
        (SELECT tm.name FROM winback_households wh 
         JOIN team_members tm ON wh.assigned_to = tm.id
         WHERE wh.contact_id = c.id AND wh.status IN ('untouched', 'in_progress') 
         LIMIT 1),
        (SELECT tm.name FROM cancel_audit_records car 
         JOIN team_members tm ON car.assigned_team_member_id = tm.id 
         WHERE car.contact_id = c.id AND car.is_active = true 
         LIMIT 1),
        (SELECT tm.name FROM renewal_records rr 
         JOIN team_members tm ON rr.assigned_team_member_id = tm.id 
         WHERE rr.contact_id = c.id AND rr.is_active = true 
         LIMIT 1),
        (SELECT tm.name FROM lqs_households lh 
         JOIN team_members tm ON lh.team_member_id = tm.id
         WHERE lh.contact_id = c.id 
         LIMIT 1)
      ) AS assigned_team_member_name
      
    FROM agency_contacts c
    WHERE c.agency_id = p_agency_id
  ),
  filtered AS (
    SELECT cs.*
    FROM contact_stages cs
    WHERE 
      -- Stage filter
      (p_stage IS NULL OR cs.computed_stage = p_stage)
      -- Search filter (multi-word name match OR phone/email match)
      AND (
        p_search IS NULL 
        OR p_search = ''
        OR (
          -- All search words must match either first_name or last_name
          (SELECT bool_and(
            lower(cs.first_name) LIKE '%' || word || '%' 
            OR lower(cs.last_name) LIKE '%' || word || '%'
          ) FROM unnest(search_words) AS word)
        )
        OR EXISTS (
          SELECT 1 FROM unnest(cs.phones) AS phone 
          WHERE phone ILIKE '%' || p_search || '%'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(cs.emails) AS email 
          WHERE email ILIKE '%' || p_search || '%'
        )
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT 
    f.id,
    f.first_name,
    f.last_name,
    f.phones,
    f.emails,
    f.household_key,
    f.computed_stage AS current_stage,
    f.last_activity_at,
    f.last_activity_type,
    f.assigned_team_member_name,
    counted.cnt AS total_count
  FROM filtered f
  CROSS JOIN counted
  ORDER BY f.last_name, f.first_name
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
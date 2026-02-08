-- Phase 3 Batch 1 hardening
-- Target high-traffic tenant RPCs that remained SECURITY DEFINER without caller validation.
-- Adds deny-by-default caller checks while preserving JWT callers and optional staff-session callers.

BEGIN;

-- -----------------------------------------------------------------------------
-- get_contacts_by_stage
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_sort_by TEXT DEFAULT 'name',
  p_sort_direction TEXT DEFAULT 'asc',
  p_staff_session_token TEXT DEFAULT NULL
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
  v_staff_member_id UUID;
BEGIN
  -- Deny by default: caller must be either an agency-authenticated user or a valid staff session.
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSIF p_staff_session_token IS NOT NULL THEN
    v_staff_member_id := public.verify_staff_session(p_staff_session_token, p_agency_id);
    IF v_staff_member_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized';
  END IF;

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
      CASE
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.is_active = true
          AND LOWER(COALESCE(car.cancel_status, '')) = 'saved'
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.is_active = true
          AND LOWER(COALESCE(car.cancel_status, '')) <> 'saved'
        ) THEN 'cancel_audit'
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id AND lqs.status = 'sold'
        ) OR EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id AND rr.current_status = 'success'
        ) OR EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id AND wh.status = 'won_back'
        ) OR EXISTS (
          SELECT 1 FROM sales s
          WHERE s.contact_id = ac.id
        ) THEN 'customer'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id AND lqs.status = 'quoted'
        ) THEN 'quoted'
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id AND lqs.status = 'lead'
        ) THEN 'open_lead'
        ELSE 'open_lead'
      END AS computed_stage,
      (SELECT MAX(ca.created_at) FROM contact_activities ca WHERE ca.contact_id = ac.id) AS last_activity_at,
      (SELECT ca.activity_type FROM contact_activities ca WHERE ca.contact_id = ac.id ORDER BY ca.created_at DESC LIMIT 1) AS last_activity_type,
      COALESCE(
        (SELECT tm.name FROM team_members tm
         JOIN winback_households wh ON wh.assigned_to = tm.id
         WHERE wh.contact_id = ac.id AND wh.status IN ('untouched', 'in_progress')
         LIMIT 1),
        (SELECT tm.name FROM team_members tm
         JOIN cancel_audit_records car ON car.assigned_team_member_id = tm.id
         WHERE car.contact_id = ac.id AND car.is_active = true
         LIMIT 1),
        (SELECT tm.name FROM team_members tm
         JOIN renewal_records rr ON rr.assigned_team_member_id = tm.id
         WHERE rr.contact_id = ac.id AND rr.is_active = true
         LIMIT 1),
        (SELECT tm.name FROM team_members tm
         JOIN lqs_households lqs ON lqs.team_member_id = tm.id
         WHERE lqs.contact_id = ac.id
         LIMIT 1),
        (SELECT tm.name FROM team_members tm
         JOIN sales s ON s.team_member_id = tm.id
         WHERE s.contact_id = ac.id
         ORDER BY s.sale_date DESC
         LIMIT 1)
      ) AS assigned_team_member_name
    FROM agency_contacts ac
    WHERE ac.agency_id = p_agency_id
      AND (
        search_words IS NULL
        OR (
          SELECT bool_and(
            LOWER(ac.first_name) LIKE '%' || word || '%'
            OR LOWER(ac.last_name) LIKE '%' || word || '%'
          )
          FROM unnest(search_words) AS word
        )
        OR EXISTS (SELECT 1 FROM unnest(ac.phones) ph WHERE ph ILIKE '%' || p_search || '%')
        OR EXISTS (SELECT 1 FROM unnest(ac.emails) em WHERE em ILIKE '%' || p_search || '%')
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
    cs.computed_stage AS current_stage,
    cs.last_activity_at,
    cs.last_activity_type,
    cs.assigned_team_member_name,
    COUNT(*) OVER() AS total_count
  FROM contact_stages cs
  WHERE (p_stage IS NULL OR cs.computed_stage = p_stage)
  ORDER BY
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'asc' THEN cs.first_name END ASC,
    CASE WHEN p_sort_by = 'name' AND p_sort_direction = 'desc' THEN cs.first_name END DESC,
    CASE WHEN p_sort_by = 'last_activity' AND p_sort_direction = 'asc' THEN cs.last_activity_at END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'last_activity' AND p_sort_direction = 'desc' THEN cs.last_activity_at END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'status' AND p_sort_direction = 'asc' THEN cs.computed_stage END ASC,
    CASE WHEN p_sort_by = 'status' AND p_sort_direction = 'desc' THEN cs.computed_stage END DESC,
    CASE WHEN p_sort_by = 'assigned' AND p_sort_direction = 'asc' THEN cs.assigned_team_member_name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'assigned' AND p_sort_direction = 'desc' THEN cs.assigned_team_member_name END DESC NULLS LAST,
    cs.first_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- get_dashboard_daily
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_dashboard_daily(TEXT, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_dashboard_daily(TEXT, TEXT, DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.get_dashboard_daily(
  p_agency_slug text,
  p_role text,
  p_start date,
  p_end date,
  p_staff_session_token text DEFAULT NULL
)
RETURNS TABLE (
  team_member_id uuid,
  team_member_name text,
  date date,
  outbound_calls integer,
  talk_minutes integer,
  quoted_households integer,
  items_sold integer,
  cross_sells_uncovered integer,
  mini_reviews integer,
  custom_kpis jsonb,
  kpi_version_id uuid,
  label_at_submit text,
  daily_score integer,
  hits integer,
  pass boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  agency_rec record;
  rules_rec record;
  v_staff_member_id uuid;
BEGIN
  SELECT id INTO agency_rec FROM agencies WHERE slug = p_agency_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agency not found: %', p_agency_slug;
  END IF;

  -- Deny by default: caller must be either an agency-authenticated user or a valid staff session.
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_agency_access(auth.uid(), agency_rec.id) THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSIF p_staff_session_token IS NOT NULL THEN
    v_staff_member_id := public.verify_staff_session(p_staff_session_token, agency_rec.id);
    IF v_staff_member_id IS NULL THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO rules_rec FROM scorecard_rules
  WHERE agency_id = agency_rec.id AND role::text = p_role;

  IF NOT FOUND THEN
    RAISE NOTICE 'No scorecard rules found for agency % role %', p_agency_slug, p_role;
    RETURN;
  END IF;

  RETURN QUERY
  WITH daily_data AS (
    SELECT
      md.team_member_id,
      tm.name as team_member_name,
      md.date,
      COALESCE(md.outbound_calls, 0) as outbound_calls,
      COALESCE(md.talk_minutes, 0) as talk_minutes,
      COALESCE(md.quoted_count, 0) as quoted_count_internal,
      COALESCE(md.sold_items, 0) as sold_items_internal,
      COALESCE(md.cross_sells_uncovered, 0) as cross_sells_uncovered,
      COALESCE(md.mini_reviews, 0) as mini_reviews,
      COALESCE(md.custom_kpis, '{}'::jsonb) as custom_kpis,
      md.kpi_version_id,
      md.label_at_submit
    FROM metrics_daily md
    JOIN team_members tm ON tm.id = md.team_member_id
      AND tm.include_in_metrics = true
    WHERE md.agency_id = agency_rec.id
      AND (md.role::text = p_role OR md.role::text = 'Hybrid')
      AND md.date BETWEEN p_start AND p_end
  ),
  scored_data AS (
    SELECT
      dd.*,
      (CASE WHEN dd.outbound_calls >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'outbound_calls'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.talk_minutes >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'talk_minutes'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.quoted_count_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'quoted_households'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.sold_items_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'items_sold'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.cross_sells_uncovered >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'cross_sells_uncovered'), 0) THEN 1 ELSE 0 END +
       CASE WHEN dd.mini_reviews >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'mini_reviews'), 0) THEN 1 ELSE 0 END
      ) as hits_count,
      (CASE WHEN dd.outbound_calls >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'outbound_calls'), 0)
            THEN COALESCE((rules_rec.weights->>'outbound_calls')::integer, 0) ELSE 0 END +
       CASE WHEN dd.talk_minutes >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'talk_minutes'), 0)
            THEN COALESCE((rules_rec.weights->>'talk_minutes')::integer, 0) ELSE 0 END +
       CASE WHEN dd.quoted_count_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'quoted_households'), 0)
            THEN COALESCE((rules_rec.weights->>'quoted_households')::integer, 0) ELSE 0 END +
       CASE WHEN dd.sold_items_internal >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'items_sold'), 0)
            THEN COALESCE((rules_rec.weights->>'items_sold')::integer, 0) ELSE 0 END +
       CASE WHEN dd.cross_sells_uncovered >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'cross_sells_uncovered'), 0)
            THEN COALESCE((rules_rec.weights->>'cross_sells_uncovered')::integer, 0) ELSE 0 END +
       CASE WHEN dd.mini_reviews >= GREATEST(get_target(agency_rec.id, dd.team_member_id, 'mini_reviews'), 0)
            THEN COALESCE((rules_rec.weights->>'mini_reviews')::integer, 0) ELSE 0 END
      ) as weighted_score
    FROM daily_data dd
  )
  SELECT
    sd.team_member_id,
    sd.team_member_name,
    sd.date,
    sd.outbound_calls,
    sd.talk_minutes,
    sd.quoted_count_internal AS quoted_households,
    sd.sold_items_internal AS items_sold,
    sd.cross_sells_uncovered,
    sd.mini_reviews,
    sd.custom_kpis,
    sd.kpi_version_id,
    sd.label_at_submit,
    sd.weighted_score as daily_score,
    sd.hits_count as hits,
    (sd.hits_count >= COALESCE(rules_rec.n_required, 2)) as pass
  FROM scored_data sd
  ORDER BY sd.date DESC, sd.team_member_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_daily(TEXT, TEXT, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_daily(TEXT, TEXT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_daily(TEXT, TEXT, DATE, DATE, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_daily(TEXT, TEXT, DATE, DATE, TEXT) TO service_role;

COMMIT;

-- Fix renewal_records status values in auto-link function and reorder stage priorities
-- in get_contacts_by_stage to prevent winback from overriding active cancel audit / customer stages.
--
-- Bug 1: renewal_records CHECK constraint is ('uncontacted','pending','success','unsuccessful')
--   but auto_link used 'lost' (invalid) and filtered by ('new','in_progress') (also invalid).
-- Bug 2: winback was Priority 1 in get_contacts_by_stage — if John has 3 policies and only Auto
--   terminates, he showed as 'winback' even if Home/Umbrella were still in cancel audit or active.
--   Fix: move winback to P5, add has_winback_opportunity flag for UI tagging.

BEGIN;

-- ============================================================================
-- A) Fix auto_link_terminations_to_cancel_and_renewal — renewal status values
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_link_terminations_to_cancel_and_renewal(
  p_agency_id UUID,
  p_policy_numbers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancel_linked INT := 0;
  v_cancel_demoted INT := 0;
  v_renewals_linked INT := 0;
  v_renewals_demoted INT := 0;
  v_contacts_linked INT := 0;
BEGIN
  -- Agency access check for authenticated callers (service_role has auth.uid() = NULL)
  IF auth.uid() IS NOT NULL THEN
    IF NOT has_agency_access(auth.uid(), p_agency_id) THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
    END IF;
  END IF;

  -- ============================================================
  -- PASS 1a: Link cancel_audit_records → winback_households
  -- ============================================================
  WITH matched AS (
    SELECT DISTINCT ON (car.id)
      car.id AS cancel_record_id,
      car.contact_id AS cancel_contact_id,
      car.household_key AS cancel_household_key,
      wp.household_id AS winback_household_id,
      wh.contact_id AS wh_contact_id
    FROM cancel_audit_records car
    JOIN winback_policies wp
      ON wp.policy_number = car.policy_number
     AND wp.agency_id = car.agency_id
    JOIN winback_households wh
      ON wh.id = wp.household_id
    WHERE car.agency_id = p_agency_id
      AND car.policy_number = ANY(p_policy_numbers)
      AND car.winback_household_id IS NULL
    ORDER BY car.id
  ),
  updated_car AS (
    UPDATE cancel_audit_records car
    SET winback_household_id = m.winback_household_id,
        sent_to_winback_at = NOW()
    FROM matched m
    WHERE car.id = m.cancel_record_id
    RETURNING car.id
  ),
  contacts_from_cancel AS (
    UPDATE winback_households wh
    SET contact_id = m.cancel_contact_id
    FROM matched m
    WHERE wh.id = m.winback_household_id
      AND wh.contact_id IS NULL
      AND m.cancel_contact_id IS NOT NULL
    RETURNING wh.id
  )
  SELECT
    (SELECT COUNT(*) FROM updated_car),
    (SELECT COUNT(*) FROM contacts_from_cancel)
  INTO v_cancel_linked, v_contacts_linked;

  -- ============================================================
  -- PASS 1b: Link renewal_records → winback_households
  -- ============================================================
  WITH matched_rr AS (
    SELECT DISTINCT ON (rr.id)
      rr.id AS renewal_record_id,
      rr.contact_id AS renewal_contact_id,
      wp.household_id AS winback_household_id,
      wh.contact_id AS wh_contact_id
    FROM renewal_records rr
    JOIN winback_policies wp
      ON wp.policy_number = rr.policy_number
     AND wp.agency_id = rr.agency_id
    JOIN winback_households wh
      ON wh.id = wp.household_id
    WHERE rr.agency_id = p_agency_id
      AND rr.policy_number = ANY(p_policy_numbers)
      AND rr.winback_household_id IS NULL
    ORDER BY rr.id
  ),
  updated_rr AS (
    UPDATE renewal_records rr
    SET winback_household_id = m.winback_household_id,
        sent_to_winback_at = NOW()
    FROM matched_rr m
    WHERE rr.id = m.renewal_record_id
    RETURNING rr.id
  ),
  contacts_from_renewal AS (
    UPDATE winback_households wh
    SET contact_id = m.renewal_contact_id
    FROM matched_rr m
    WHERE wh.id = m.winback_household_id
      AND wh.contact_id IS NULL
      AND m.renewal_contact_id IS NOT NULL
    RETURNING wh.id
  )
  SELECT
    v_renewals_linked + (SELECT COUNT(*) FROM updated_rr),
    v_contacts_linked + (SELECT COUNT(*) FROM contacts_from_renewal)
  INTO v_renewals_linked, v_contacts_linked;

  -- ============================================================
  -- PASS 2a: Demote active cancel_audit_records to 'lost'
  -- ============================================================
  WITH demoted_car AS (
    UPDATE cancel_audit_records car
    SET status = 'lost'
    WHERE car.agency_id = p_agency_id
      AND car.policy_number = ANY(p_policy_numbers)
      AND car.winback_household_id IS NOT NULL
      AND car.status IN ('new', 'in_progress')
    RETURNING car.id, car.agency_id, car.household_key
  ),
  logged_car AS (
    INSERT INTO cancel_audit_activities (
      agency_id, record_id, household_key, activity_type, notes, user_display_name
    )
    SELECT
      d.agency_id,
      d.id,
      d.household_key,
      'note',
      'Auto-moved to Win-Back (termination upload)',
      'System'
    FROM demoted_car d
    RETURNING id
  )
  SELECT COUNT(*) FROM demoted_car INTO v_cancel_demoted;

  -- ============================================================
  -- PASS 2b: Demote active renewal_records to 'unsuccessful'
  -- (CHECK constraint: 'uncontacted','pending','success','unsuccessful')
  -- ============================================================
  WITH demoted_rr AS (
    UPDATE renewal_records rr
    SET current_status = 'unsuccessful',
        auto_resolved_reason = 'terminated_moved_to_winback'
    WHERE rr.agency_id = p_agency_id
      AND rr.policy_number = ANY(p_policy_numbers)
      AND rr.winback_household_id IS NOT NULL
      AND rr.current_status IN ('uncontacted', 'pending')
    RETURNING rr.id, rr.agency_id, rr.household_key
  ),
  logged_rr AS (
    INSERT INTO renewal_activities (
      agency_id, renewal_record_id, household_key, activity_type, comments, created_by_display_name
    )
    SELECT
      d.agency_id,
      d.id,
      d.household_key,
      'note',
      'Auto-moved to Win-Back (termination upload)',
      'System'
    FROM demoted_rr d
    RETURNING id
  )
  SELECT COUNT(*) FROM demoted_rr INTO v_renewals_demoted;

  RETURN jsonb_build_object(
    'cancel_audit_linked', v_cancel_linked,
    'cancel_audit_demoted', v_cancel_demoted,
    'renewals_linked', v_renewals_linked,
    'renewals_demoted', v_renewals_demoted,
    'contacts_linked', v_contacts_linked
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION auto_link_terminations_to_cancel_and_renewal(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auto_link_terminations_to_cancel_and_renewal(UUID, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION auto_link_terminations_to_cancel_and_renewal(UUID, TEXT[]) TO authenticated;

-- ============================================================================
-- B) Update get_contacts_by_stage — reorder priorities + add has_winback_opportunity
-- ============================================================================

-- Drop all old overloads: 8-param (hardened) and 5-param (pre-hardening, no auth checks)
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_contacts_by_stage(
  p_agency_id UUID,
  p_stage TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_sort_by TEXT DEFAULT 'name',
  p_sort_direction TEXT DEFAULT 'asc',
  p_staff_session_token TEXT DEFAULT NULL,
  p_has_winback_opportunity BOOLEAN DEFAULT NULL
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
  has_winback_opportunity BOOLEAN,
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
        -- P1: Cancel audit unresolved (new or in_progress) → still in cancel process
        -- Must come before saved check: active work on ANY policy takes priority
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND car.status IN ('new', 'in_progress')
        ) THEN 'cancel_audit'

        -- P2: Cancel audit SAVED + resolved (no active work remaining) → customer
        WHEN EXISTS (
          SELECT 1 FROM cancel_audit_records car
          WHERE car.contact_id = ac.id
          AND car.agency_id = p_agency_id
          AND car.status = 'resolved'
          AND LOWER(COALESCE(car.cancel_status, '')) = 'saved'
        ) THEN 'customer'

        -- P3: Pending renewal
        WHEN EXISTS (
          SELECT 1 FROM renewal_records rr
          WHERE rr.contact_id = ac.id
          AND rr.agency_id = p_agency_id
          AND rr.is_active = true
          AND rr.current_status IN ('uncontacted', 'pending')
        ) THEN 'renewal'

        -- P4: Customer (sold LQS, success renewal, won_back, or has sales)
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

        -- P5: Winback (untouched or in_progress) — only if no higher-priority stage
        WHEN EXISTS (
          SELECT 1 FROM winback_households wh
          WHERE wh.contact_id = ac.id
          AND wh.status IN ('untouched', 'in_progress')
        ) THEN 'winback'

        -- P6: Quoted HH
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id AND lqs.status = 'quoted'
        ) THEN 'quoted'

        -- P7: Open Lead
        WHEN EXISTS (
          SELECT 1 FROM lqs_households lqs
          WHERE lqs.contact_id = ac.id AND lqs.status = 'lead'
        ) THEN 'open_lead'

        ELSE 'open_lead'
      END AS computed_stage,

      -- Winback opportunity flag: true when contact has active winback regardless of stage
      EXISTS (
        SELECT 1 FROM winback_households wh
        WHERE wh.contact_id = ac.id
        AND wh.agency_id = p_agency_id
        AND wh.status IN ('untouched', 'in_progress')
      ) AS has_winback_opp,

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
    cs.has_winback_opp AS has_winback_opportunity,
    COUNT(*) OVER() AS total_count
  FROM contact_stages cs
  WHERE (p_stage IS NULL OR cs.computed_stage = p_stage)
    AND (p_has_winback_opportunity IS NULL OR cs.has_winback_opp = p_has_winback_opportunity)
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

REVOKE ALL ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.get_contacts_by_stage(UUID, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

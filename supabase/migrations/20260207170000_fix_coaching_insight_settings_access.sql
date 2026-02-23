-- Restrict coaching insight settings access to manager/owner-level users
-- while still allowing manager-role linked profiles.

CREATE OR REPLACE FUNCTION public.can_manage_coaching_insight_settings(p_agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_has_access BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = v_user_id
        AND (p.role = 'admin' OR p.agency_id = p_agency_id)
    ) INTO v_has_access;
    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regclass('public.key_employees') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.key_employees ke
      WHERE ke.user_id = v_user_id
        AND ke.agency_id = p_agency_id
    ) INTO v_has_access;
    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  IF
    to_regclass('public.staff_users') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = 'public.staff_users'::regclass
        AND attname = 'linked_profile_id'
        AND NOT attisdropped
    )
    AND to_regclass('public.team_members') IS NOT NULL
  THEN
    EXECUTE $query$
      SELECT EXISTS (
        SELECT 1
        FROM public.staff_users su
        JOIN public.team_members tm ON tm.id = su.team_member_id
        WHERE su.linked_profile_id = $1
          AND su.agency_id = $2
          AND su.is_active = true
          AND tm.role::text IN ('Manager', 'Owner')
      )
    $query$ INTO v_has_access USING v_user_id, p_agency_id;
    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Users can manage own agency coaching settings" ON public.coaching_insight_settings;

CREATE POLICY "Manager or owner can read coaching settings"
  ON public.coaching_insight_settings
  FOR SELECT
  USING (public.can_manage_coaching_insight_settings(agency_id));

CREATE POLICY "Manager or owner can insert coaching settings"
  ON public.coaching_insight_settings
  FOR INSERT
  WITH CHECK (public.can_manage_coaching_insight_settings(agency_id));

CREATE POLICY "Manager or owner can update coaching settings"
  ON public.coaching_insight_settings
  FOR UPDATE
  USING (public.can_manage_coaching_insight_settings(agency_id))
  WITH CHECK (public.can_manage_coaching_insight_settings(agency_id));

CREATE POLICY "Manager or owner can delete coaching settings"
  ON public.coaching_insight_settings
  FOR DELETE
  USING (public.can_manage_coaching_insight_settings(agency_id));

COMMENT ON FUNCTION public.can_manage_coaching_insight_settings(uuid) IS
  'Returns true if auth user can manage coaching insight settings for an agency (admin, owner, key employee, or linked manager role).';

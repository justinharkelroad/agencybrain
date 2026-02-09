-- Restrict coaching insight settings access to manager/owner-level users
-- while still allowing manager-role linked profiles.

CREATE OR REPLACE FUNCTION public.can_manage_coaching_insight_settings(p_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      -- Admins and agency owners via profiles
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.role = 'admin' OR p.agency_id = p_agency_id)
      )
      -- Key employees inherit owner-level access
      OR EXISTS (
        SELECT 1
        FROM public.key_employees ke
        WHERE ke.user_id = auth.uid()
          AND ke.agency_id = p_agency_id
      )
      -- Linked manager/owner staff profiles
      OR EXISTS (
        SELECT 1
        FROM public.staff_users su
        JOIN public.team_members tm ON tm.id = su.team_member_id
        WHERE su.linked_profile_id = auth.uid()
          AND su.agency_id = p_agency_id
          AND su.is_active = true
          AND tm.role::text IN ('Manager', 'Owner')
      )
    );
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

-- =====================================================
-- Mission Control access should be agency-owner scoped,
-- not restricted to the exact profile id stored on rows.
-- This allows the active 1:1 owner profile for the agency
-- to read/write the shared workspace even if admin created
-- records under a different owner-linked profile.
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_mission_control_access(
  _user_id uuid,
  _agency_id uuid,
  _owner_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = COALESCE(_user_id, auth.uid())
      AND ur.role = 'admin'
  )
  OR (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = COALESCE(_user_id, auth.uid())
        AND p.agency_id = _agency_id
        AND p.membership_tier = '1:1 Coaching'
        AND NOT EXISTS (
          SELECT 1
          FROM public.key_employees ke
          WHERE ke.user_id = p.id
            AND ke.agency_id = _agency_id
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles owner_profile
      WHERE owner_profile.id = _owner_user_id
        AND owner_profile.agency_id = _agency_id
    )
  );
$$;

COMMENT ON FUNCTION public.has_mission_control_access(uuid, uuid, uuid)
IS 'Returns true for admins or for the active 1:1 agency owner tied to the same agency as the mission control workspace.';

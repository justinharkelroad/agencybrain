-- Add manager access tier support for Standard Playbook
-- This enables agency owners to give managers access to specific training content
-- that regular staff members cannot see.

-- Helper function to check if a staff user has Manager or Owner role
CREATE OR REPLACE FUNCTION public.is_staff_manager(p_staff_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_users su
    JOIN team_members tm ON tm.id = su.team_member_id
    WHERE su.id = p_staff_user_id
      AND tm.role IN ('Manager', 'Owner')
  );
$$;

-- Grant execute permission to service role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.is_staff_manager(uuid) TO service_role;

COMMENT ON FUNCTION public.is_staff_manager(uuid) IS
  'Checks if a staff user has Manager or Owner role via their team_member link. Used for manager-tier training access control.';

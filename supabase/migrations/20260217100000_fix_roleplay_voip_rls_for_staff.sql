-- Fix roleplay_access_tokens and voip_integrations RLS for key employees + staff managers
-- Bug: Both tables used direct profiles subqueries instead of has_agency_access(),
-- blocking key employees and staff managers from accessing features they need.

-- =============================================================================
-- roleplay_access_tokens
-- =============================================================================
-- Access should be granted to: agency owners, key employees, staff managers
-- The original policies used: SELECT agency_id FROM profiles WHERE id = auth.uid()
-- which blocks key employees (agency_id in key_employees table) and staff managers

DROP POLICY IF EXISTS "users_can_select_own_agency_tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "users_can_update_own_agency_tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON roleplay_access_tokens;
DROP POLICY IF EXISTS "Users can create tokens" ON roleplay_access_tokens;

-- SELECT: agency owners, key employees, staff managers, and admins
CREATE POLICY "agency_members_select_roleplay_tokens"
  ON roleplay_access_tokens FOR SELECT
  USING (
    has_agency_access(auth.uid(), agency_id)
  );

-- UPDATE: agency owners, key employees, staff managers, and admins
CREATE POLICY "agency_members_update_roleplay_tokens"
  ON roleplay_access_tokens FOR UPDATE
  USING (
    has_agency_access(auth.uid(), agency_id)
  );

-- INSERT: agency owners, key employees, and admins can create tokens
CREATE POLICY "agency_members_insert_roleplay_tokens"
  ON roleplay_access_tokens FOR INSERT
  WITH CHECK (
    has_agency_access(auth.uid(), agency_id)
  );

-- =============================================================================
-- voip_integrations (manage policy)
-- =============================================================================
-- Bug: The ALL policy used direct profiles check for owner/admin roles,
-- blocking staff managers with linked profiles from managing VoIP settings.
-- Fix: Use has_agency_access() combined with a role check for manager-level access.

CREATE OR REPLACE FUNCTION public.can_manage_voip_integrations(p_agency_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_can_manage boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id
      AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_user_id
      AND agency_id = p_agency_id
      AND role = 'owner'
  )
  OR EXISTS (
    SELECT 1 FROM key_employees
    WHERE user_id = v_user_id
      AND agency_id = p_agency_id
  )
  INTO v_can_manage;

  IF v_can_manage THEN
    RETURN true;
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
  THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.staff_users su
        JOIN public.team_members tm ON tm.id = su.team_member_id
        WHERE su.linked_profile_id = $1
          AND su.agency_id = $2
          AND su.is_active = true
          AND lower(coalesce(tm.role::text, '')) IN ('manager', 'owner')
      )
    $sql$
    INTO v_can_manage
    USING v_user_id, p_agency_id;

    IF v_can_manage THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Agency owners manage voip_integrations" ON voip_integrations;

CREATE POLICY "Agency owners manage voip_integrations"
  ON voip_integrations FOR ALL
  USING (
    public.can_manage_voip_integrations(voip_integrations.agency_id)
  );

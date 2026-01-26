-- Add RPC function to check challenge access grant
-- Grants temporary Core 4 + Flows access to Call Scoring tier staff on challenge

CREATE OR REPLACE FUNCTION public.get_staff_challenge_access_grant(p_staff_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb := '{"has_access": false, "granted_ids": []}'::jsonb;
BEGIN
  -- Check if staff user has an active or pending challenge assignment
  IF EXISTS (
    SELECT 1 FROM public.challenge_assignments
    WHERE staff_user_id = p_staff_user_id
      AND status IN ('active', 'pending')
  ) THEN
    -- Grant access to Core 4 and Flows nav items
    v_result := '{"has_access": true, "granted_ids": ["core4", "flows"]}'::jsonb;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_staff_challenge_access_grant(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_staff_challenge_access_grant IS 'Returns granted navigation IDs for staff users with active challenge assignments. Used to temporarily grant Core 4 and Flows access to Call Scoring tier staff.';

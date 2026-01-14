-- RPC function to get call status for staff users (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_staff_call_status(
  p_call_id uuid,
  p_agency_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'status', c.status,
    'overall_score', c.overall_score,
    'agency_id', c.agency_id
  )
  INTO result
  FROM agency_calls c
  WHERE c.id = p_call_id
    AND c.agency_id = p_agency_id;
  
  RETURN result;
END;
$$;

-- Grant execute to anon so staff can call it
GRANT EXECUTE ON FUNCTION public.get_staff_call_status(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_staff_call_status(uuid, uuid) TO authenticated;
-- Create RPC function to get agency settings for staff users (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_agency_settings(p_agency_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'staff_can_upload_calls', COALESCE(staff_can_upload_calls, true)
  )
  INTO result
  FROM agencies
  WHERE id = p_agency_id;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated and anon (for staff users)
GRANT EXECUTE ON FUNCTION public.get_agency_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_settings(UUID) TO anon;
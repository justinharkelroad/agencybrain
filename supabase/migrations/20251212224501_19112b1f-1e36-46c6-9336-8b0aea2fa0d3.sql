-- Create RPC function to check if call scoring is enabled for an agency
-- SECURITY DEFINER allows it to bypass RLS for staff users
CREATE OR REPLACE FUNCTION public.is_call_scoring_enabled(p_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM agency_call_scoring_settings WHERE agency_id = p_agency_id LIMIT 1),
    false
  );
$$;
-- Create a SECURITY DEFINER function to fetch profiles for conversation participants
-- This bypasses RLS to allow fetching profile info for users you're messaging

CREATE OR REPLACE FUNCTION public.get_conversation_participants(
  participant_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  agency_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    a.name as agency_name
  FROM profiles p
  LEFT JOIN agencies a ON p.agency_id = a.id
  WHERE p.id = ANY(participant_ids);
END;
$$;
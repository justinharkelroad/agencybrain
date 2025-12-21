-- Create a SECURITY DEFINER function to search Exchange community members
-- This bypasses RLS to allow finding any user eligible for Exchange messaging

CREATE OR REPLACE FUNCTION public.search_exchange_users(
  search_term TEXT,
  current_user_id UUID
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
  WHERE p.id != current_user_id
    AND p.role != 'admin'
    AND p.agency_id IS NOT NULL
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
      OR a.name ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE WHEN p.full_name ILIKE search_term || '%' THEN 0 ELSE 1 END,
    p.full_name
  LIMIT 10;
END;
$$;
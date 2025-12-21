-- Update search_exchange_users function to include ALL users (including admins)
CREATE OR REPLACE FUNCTION public.search_exchange_users(search_term text, current_user_id uuid)
RETURNS TABLE(id uuid, full_name text, email text, agency_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    a.name as agency_name
  FROM profiles p
  LEFT JOIN agencies a ON a.id = p.agency_id
  WHERE p.id != current_user_id
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.email ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE WHEN p.full_name ILIKE search_term || '%' THEN 0 ELSE 1 END,
    p.full_name
  LIMIT 20;
END;
$$;
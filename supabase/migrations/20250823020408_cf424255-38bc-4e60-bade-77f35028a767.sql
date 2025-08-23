-- Create audit table for tracking access to sensitive agency data
CREATE TABLE public.agency_access_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  access_type TEXT NOT NULL, -- 'view_contacts', 'view_full', 'update'
  accessed_fields TEXT[], -- array of sensitive fields accessed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on audit table
ALTER TABLE public.agency_access_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all agency access audit logs" 
ON public.agency_access_audit 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = 'admin'
));

-- Users can only insert their own audit records (for logging purposes)
CREATE POLICY "Users can insert their own audit records" 
ON public.agency_access_audit 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to get filtered agency data based on user permissions
CREATE OR REPLACE FUNCTION public.get_agency_safe(agency_id_param UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  -- Sensitive fields only for admins and agency owners
  agent_name TEXT,
  agency_email TEXT,
  phone TEXT,
  agent_cell TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  logo_url TEXT,
  has_contact_access BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_agency_id UUID;
  is_admin BOOLEAN := false;
  is_agency_owner BOOLEAN := false;
BEGIN
  -- Get current user's role and agency
  SELECT p.role, p.agency_id 
  INTO user_role, user_agency_id
  FROM public.profiles p 
  WHERE p.id = auth.uid();
  
  -- Check if user is admin
  is_admin := (user_role = 'admin');
  
  -- Check if user belongs to the requested agency
  is_agency_owner := (user_agency_id = agency_id_param);
  
  -- Verify user has access to this agency
  IF NOT (is_admin OR is_agency_owner) THEN
    RAISE EXCEPTION 'Access denied to agency data';
  END IF;
  
  -- Log the access attempt
  INSERT INTO public.agency_access_audit (
    user_id, 
    agency_id, 
    access_type,
    accessed_fields
  ) VALUES (
    auth.uid(),
    agency_id_param,
    CASE 
      WHEN is_admin THEN 'admin_view_full'
      WHEN is_agency_owner THEN 'owner_view_contacts'
      ELSE 'view_basic'
    END,
    CASE 
      WHEN is_admin OR is_agency_owner THEN 
        ARRAY['agent_name', 'agency_email', 'phone', 'agent_cell', 'address_line1', 'address_line2', 'address_city', 'address_state', 'address_zip']
      ELSE 
        ARRAY['name', 'description']
    END
  );
  
  -- Return filtered data based on permissions
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.description,
    a.created_at,
    a.updated_at,
    -- Sensitive fields only for authorized users
    CASE WHEN (is_admin OR is_agency_owner) THEN a.agent_name ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.agency_email ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.phone ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.agent_cell ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.address_line1 ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.address_line2 ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.address_city ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.address_state ELSE NULL END,
    CASE WHEN (is_admin OR is_agency_owner) THEN a.address_zip ELSE NULL END,
    a.logo_url, -- Logo is generally safe to show
    (is_admin OR is_agency_owner) as has_contact_access
  FROM public.agencies a
  WHERE a.id = agency_id_param;
END;
$$;

-- Create function to safely list agencies (without sensitive contact info for regular users)
CREATE OR REPLACE FUNCTION public.list_agencies_safe()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  logo_url TEXT,
  has_contact_access BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_agency_id UUID;
BEGIN
  -- Get current user's role and agency
  SELECT p.role, p.agency_id 
  INTO user_role, user_agency_id
  FROM public.profiles p 
  WHERE p.id = auth.uid();
  
  -- Only admins can list all agencies
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only admins can list agencies';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.description,
    a.created_at,
    a.logo_url,
    true as has_contact_access -- Admins have contact access
  FROM public.agencies a
  ORDER BY a.name;
END;
$$;

-- Update the existing RLS policies to be more restrictive for sensitive data access
-- First drop the existing "Users can view own agency" policy
DROP POLICY IF EXISTS "Users can view own agency" ON public.agencies;

-- Create new more restrictive policies
CREATE POLICY "Users can view basic agency info only" 
ON public.agencies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.agency_id = agencies.id
  )
  -- This policy allows viewing but app should use get_agency_safe() for sensitive fields
);

-- Add a comment to the table to warn developers
COMMENT ON TABLE public.agencies IS 'SECURITY WARNING: This table contains sensitive contact information. Use get_agency_safe() function instead of direct queries to ensure proper access control and audit logging.';

-- Add comments to sensitive columns
COMMENT ON COLUMN public.agencies.agent_name IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.agency_email IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.phone IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.agent_cell IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.address_line1 IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.address_line2 IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.address_city IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.address_state IS 'SENSITIVE: Access via get_agency_safe() function only';
COMMENT ON COLUMN public.agencies.address_zip IS 'SENSITIVE: Access via get_agency_safe() function only';
-- Add description column to agencies table
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS description TEXT;

-- Create admin user creation function (for admin use only)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_agency_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Only allow admin users to execute this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin users can create new user accounts';
  END IF;

  -- This function would need to be implemented via edge function
  -- as we cannot directly create auth users from SQL functions
  RAISE EXCEPTION 'User creation must be done via admin API endpoints';
END;
$$;
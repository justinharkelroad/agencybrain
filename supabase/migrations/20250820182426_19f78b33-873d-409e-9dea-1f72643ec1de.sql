-- Fix infinite recursion in profiles table RLS policies
-- Create security definer function to safely check user role without triggering RLS

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing problematic policies on profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Create new policies using the security definer function
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Fix the agencies table policies that were just created to also use the security definer function
DROP POLICY IF EXISTS "Admins can insert agencies" ON public.agencies;
DROP POLICY IF EXISTS "Admins can update any agency" ON public.agencies;

CREATE POLICY "Admins can insert agencies" 
ON public.agencies 
FOR INSERT 
WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update any agency" 
ON public.agencies 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');
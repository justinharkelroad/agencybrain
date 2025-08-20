-- Fix critical security vulnerability in agencies table INSERT/UPDATE policies
-- Current policies allow any authenticated user to insert/update agencies
-- This allows competitors to manipulate business directory data

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert agencies" ON public.agencies;
DROP POLICY IF EXISTS "Authenticated users can update agencies" ON public.agencies;

-- Create secure replacement policies for INSERT
-- Only admins can create new agencies
CREATE POLICY "Admins can insert agencies" 
ON public.agencies 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Users can insert their own agency (during signup process)
CREATE POLICY "Users can insert own agency" 
ON public.agencies 
FOR INSERT 
WITH CHECK (
  -- Allow if user doesn't have an agency yet (new user signup)
  NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
  )
);

-- Create secure replacement policies for UPDATE
-- Admins can update any agency
CREATE POLICY "Admins can update any agency" 
ON public.agencies 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Users can only update their own agency
CREATE POLICY "Users can update own agency" 
ON public.agencies 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.agency_id = agencies.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.agency_id = agencies.id
  )
);
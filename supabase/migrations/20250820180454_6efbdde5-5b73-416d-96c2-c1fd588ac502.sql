-- Fix critical security vulnerability in agencies table
-- Current policy allows any authenticated user to view all agencies
-- This exposes sensitive business contact information

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all agencies" ON public.agencies;

-- Create secure replacement policies
-- Users can only view their own agency information
CREATE POLICY "Users can view own agency" 
ON public.agencies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.agency_id = agencies.id
  )
);

-- Admins can view all agencies (for administrative purposes)
CREATE POLICY "Admins can view all agencies" 
ON public.agencies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
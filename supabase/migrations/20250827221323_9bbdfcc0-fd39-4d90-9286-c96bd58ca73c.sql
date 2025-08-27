-- Step 1: Fix remaining supabase references that should be supa
-- (These will need to be updated in the code files, not SQL)

-- Step 2: Remove debug logs from supabase singleton
-- This is handled in code

-- Step 3: Database Security Fixes

-- Fix 1: Lock down public tables (process_vault_types, prompts)
REVOKE ALL ON TABLE public.process_vault_types FROM anon, authenticated;
REVOKE ALL ON TABLE public.prompts FROM anon, authenticated;

-- Enable RLS on public tables
ALTER TABLE public.process_vault_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies for process_vault_types
DROP POLICY IF EXISTS "Users can view active process vault types" ON public.process_vault_types;
CREATE POLICY "Authenticated users can view active process vault types" 
ON public.process_vault_types 
FOR SELECT 
TO authenticated 
USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage all process vault types" ON public.process_vault_types;
CREATE POLICY "Admins can manage all process vault types" 
ON public.process_vault_types 
FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create restrictive policies for prompts  
DROP POLICY IF EXISTS "Anyone can view active prompts" ON public.prompts;
CREATE POLICY "Authenticated users can view active prompts" 
ON public.prompts 
FOR SELECT 
TO authenticated 
USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage all prompts" ON public.prompts;
CREATE POLICY "Admins can manage all prompts" 
ON public.prompts 
FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Fix 2: Set search_path on functions that need hardening
ALTER FUNCTION public.get_agency_safe(uuid) SET search_path = public;
ALTER FUNCTION public.list_agencies_safe() SET search_path = public;
ALTER FUNCTION public.has_agency_access(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.validate_agency_file() SET search_path = public;
ALTER FUNCTION public.init_member_checklist_items() SET search_path = public;
ALTER FUNCTION public.apply_new_agency_template_to_members() SET search_path = public;
ALTER FUNCTION public.sync_mci_secured_on_file_change() SET search_path = public;
ALTER FUNCTION public.upsert_metrics_from_submission(uuid) SET search_path = public;
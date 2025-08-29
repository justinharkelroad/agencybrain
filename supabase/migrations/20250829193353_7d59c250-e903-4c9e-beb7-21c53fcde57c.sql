-- Fix prompts and process_vault_types RLS policies for proper access

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "prompts_select_auth" ON public.prompts;
DROP POLICY IF EXISTS "prompts_read_auth" ON public.prompts;
DROP POLICY IF EXISTS "pvt_select_auth" ON public.process_vault_types;
DROP POLICY IF EXISTS "pvt_read_auth" ON public.process_vault_types;

-- Create proper RLS policies for prompts
CREATE POLICY "prompts_select_authenticated" ON public.prompts
  FOR SELECT TO authenticated 
  USING (is_active = true);

CREATE POLICY "prompts_select_anonymous" ON public.prompts
  FOR SELECT TO anon 
  USING (is_active = true);

-- Create proper RLS policies for process_vault_types  
CREATE POLICY "pvt_select_authenticated" ON public.process_vault_types
  FOR SELECT TO authenticated 
  USING (is_active = true);

CREATE POLICY "pvt_select_anonymous" ON public.process_vault_types
  FOR SELECT TO anon 
  USING (is_active = true);

-- Ensure RLS is enabled on both tables
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_vault_types ENABLE ROW LEVEL SECURITY;
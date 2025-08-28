-- Temporary RLS policies to allow authenticated reads for active rows
-- This unblocks the UI while we migrate components to use bulletproof fetchers

-- prompts table
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompts_read_auth" ON public.prompts;
CREATE POLICY "prompts_read_auth"
ON public.prompts
FOR SELECT
TO authenticated
USING (is_active = true);

-- process_vault_types table  
ALTER TABLE public.process_vault_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pvt_read_auth" ON public.process_vault_types;
CREATE POLICY "pvt_read_auth"
ON public.process_vault_types
FOR SELECT
TO authenticated
USING (is_active = true);
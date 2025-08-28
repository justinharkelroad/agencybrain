-- Update RLS policies for prompts and process_vault_types to require authentication
-- prompts
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_active_prompts" ON public.prompts;
DROP POLICY IF EXISTS "auth_read_active_prompts" ON public.prompts;
DROP POLICY IF EXISTS "prompts_select_auth" ON public.prompts;

CREATE POLICY "prompts_select_auth" 
ON public.prompts
FOR SELECT 
TO authenticated
USING (is_active = true);

-- process_vault_types  
ALTER TABLE public.process_vault_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_active_pvt" ON public.process_vault_types;
DROP POLICY IF EXISTS "auth_read_active_pvt" ON public.process_vault_types;
DROP POLICY IF EXISTS "pvt_select_auth" ON public.process_vault_types;

CREATE POLICY "pvt_select_auth" 
ON public.process_vault_types
FOR SELECT 
TO authenticated
USING (is_active = true);
-- PROMPTS
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_active_prompts" ON public.prompts;
CREATE POLICY "anon_read_active_prompts"
ON public.prompts
FOR SELECT
TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "auth_read_active_prompts" ON public.prompts;
CREATE POLICY "auth_read_active_prompts"
ON public.prompts
FOR SELECT
TO authenticated
USING (is_active = true);

-- PROCESS VAULT TYPES
ALTER TABLE public.process_vault_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_active_pvt" ON public.process_vault_types;
CREATE POLICY "anon_read_active_pvt"
ON public.process_vault_types
FOR SELECT
TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "auth_read_active_pvt" ON public.process_vault_types;
CREATE POLICY "auth_read_active_pvt"
ON public.process_vault_types
FOR SELECT
TO authenticated
USING (is_active = true);
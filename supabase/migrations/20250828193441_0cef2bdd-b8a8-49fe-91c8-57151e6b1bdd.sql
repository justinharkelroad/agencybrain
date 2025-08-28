-- Add anonymous access to prompts and process_vault_types for RLS policies
-- This allows the anonymous fallback client to read active records

-- PROMPTS: Add anonymous read policy for active prompts
DROP POLICY IF EXISTS "anon read active prompts" ON public.prompts;
CREATE POLICY "anon read active prompts"
ON public.prompts FOR SELECT
TO anon
USING (is_active = true);

-- PROCESS VAULT TYPES: Add anonymous read policy for active types  
DROP POLICY IF EXISTS "anon read active types" ON public.process_vault_types;
CREATE POLICY "anon read active types"
ON public.process_vault_types FOR SELECT
TO anon
USING (is_active = true);
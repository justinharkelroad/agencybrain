-- Ensure proper grants for anonymous access to public tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.prompts TO anon, authenticated;
GRANT SELECT ON public.process_vault_types TO anon, authenticated;

-- Verify the grants are working by ensuring policies exist
-- (These policies should already exist based on current setup)
DO $$
BEGIN
  -- Check if anon policies exist for prompts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prompts' 
    AND policyname = 'anon read active prompts'
  ) THEN
    CREATE POLICY "anon read active prompts" ON public.prompts
      FOR SELECT USING (is_active = true);
  END IF;

  -- Check if anon policies exist for process_vault_types  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'process_vault_types' 
    AND policyname = 'anon read active types'
  ) THEN
    CREATE POLICY "anon read active types" ON public.process_vault_types
      FOR SELECT USING (is_active = true);
  END IF;
END $$;
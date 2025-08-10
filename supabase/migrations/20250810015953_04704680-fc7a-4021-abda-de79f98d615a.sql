-- Add default Process Vault Type: ACCOUNTABILITY if it doesn't exist
INSERT INTO public.process_vault_types (title, is_active)
SELECT 'ACCOUNTABILITY', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.process_vault_types WHERE lower(title) = 'accountability'
);

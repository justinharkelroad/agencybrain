-- Add agency_id column to form_links table
ALTER TABLE public.form_links
ADD COLUMN IF NOT EXISTS agency_id uuid;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'form_links_agency_id_fkey'
      AND c.conrelid = 'public.form_links'::regclass
  ) THEN
    ALTER TABLE public.form_links
      ADD CONSTRAINT form_links_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'form_links_form_template_id_fkey'
      AND c.conrelid = 'public.form_links'::regclass
  ) THEN
    ALTER TABLE public.form_links
      ADD CONSTRAINT form_links_form_template_id_fkey
      FOREIGN KEY (form_template_id) REFERENCES public.form_templates(id);
  END IF;
END $$;

-- Seed test data - ensure parents exist and upsert link row
DO $$
DECLARE
  v_agency_id uuid;
  v_template_id uuid;
BEGIN
  SELECT id INTO v_agency_id
  FROM public.agencies
  WHERE slug = 'hfi-inc'
  LIMIT 1;

  SELECT id INTO v_template_id
  FROM public.form_templates
  WHERE slug = 'daily-sales-scorecard'
  LIMIT 1;

  IF v_agency_id IS NULL OR v_template_id IS NULL THEN
    RAISE NOTICE 'Skipping form_links seed row: required agency/template not yet provisioned (agency found: %, template found: %).',
      (v_agency_id IS NOT NULL),
      (v_template_id IS NOT NULL);
    RETURN;
  END IF;

  INSERT INTO public.form_links (token, enabled, agency_id, form_template_id, expires_at)
  VALUES (
    '30a2a3a3-53d4-4177-a63a-037c7e8680bb',
    true,
    v_agency_id,
    v_template_id,
    NULL
  )
  ON CONFLICT (token) DO UPDATE
  SET enabled = EXCLUDED.enabled,
      agency_id = EXCLUDED.agency_id,
      form_template_id = EXCLUDED.form_template_id,
      expires_at = EXCLUDED.expires_at;
END $$;

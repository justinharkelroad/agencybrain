-- Add foreign key constraints to form_links table
DO $$
DECLARE
  v_form_template_id UUID;
  v_agency_id UUID;
BEGIN
  -- Add FK to agencies only if agency_id column exists and constraint is absent.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'form_links'
      AND column_name = 'agency_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'form_links_agency_id_fkey'
        AND conrelid = 'public.form_links'::regclass
    ) THEN
      ALTER TABLE public.form_links
        ADD CONSTRAINT form_links_agency_id_fkey
        FOREIGN KEY (agency_id) REFERENCES public.agencies(id);
    END IF;
  END IF;

  -- Add FK to form_templates when missing.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'form_links_form_template_id_fkey'
      AND conrelid = 'public.form_links'::regclass
  ) THEN
    ALTER TABLE public.form_links
      ADD CONSTRAINT form_links_form_template_id_fkey
      FOREIGN KEY (form_template_id) REFERENCES public.form_templates(id);
  END IF;

  SELECT id INTO v_form_template_id
  FROM public.form_templates
  WHERE slug = 'daily-sales-scorecard'
  LIMIT 1;

  IF v_form_template_id IS NULL THEN
    RAISE NOTICE 'Skipping form_links seed row: template slug daily-sales-scorecard not found.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'form_links'
      AND column_name = 'agency_id'
  ) THEN
    SELECT id INTO v_agency_id
    FROM public.agencies
    WHERE slug = 'hfi-inc'
    LIMIT 1;

    IF v_agency_id IS NOT NULL THEN
      INSERT INTO public.form_links (token, enabled, agency_id, form_template_id, expires_at)
      VALUES ('30a2a3a3-53d4-4177-a63a-037c7e8680bb', true, v_agency_id, v_form_template_id, NULL)
      ON CONFLICT (token) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        agency_id = EXCLUDED.agency_id,
        form_template_id = EXCLUDED.form_template_id,
        expires_at = EXCLUDED.expires_at;
    ELSE
      INSERT INTO public.form_links (token, enabled, form_template_id, expires_at)
      VALUES ('30a2a3a3-53d4-4177-a63a-037c7e8680bb', true, v_form_template_id, NULL)
      ON CONFLICT (token) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        form_template_id = EXCLUDED.form_template_id,
        expires_at = EXCLUDED.expires_at;
    END IF;
  ELSE
    INSERT INTO public.form_links (token, enabled, form_template_id, expires_at)
    VALUES ('30a2a3a3-53d4-4177-a63a-037c7e8680bb', true, v_form_template_id, NULL)
    ON CONFLICT (token) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      form_template_id = EXCLUDED.form_template_id,
      expires_at = EXCLUDED.expires_at;
  END IF;
END $$;

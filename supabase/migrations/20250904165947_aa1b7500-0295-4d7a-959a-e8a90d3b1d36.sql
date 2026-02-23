-- Add missing lead_source field to quotedDetails section
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.form_section_field_types
    WHERE section_type = 'quotedDetails'
      AND field_key = 'lead_source'
  ) THEN
    UPDATE public.form_section_field_types
    SET
      field_label = 'Lead Source',
      field_type = 'select',
      is_sticky = true,
      is_system_required = true,
      order_index = 2,
      updated_at = now()
    WHERE section_type = 'quotedDetails'
      AND field_key = 'lead_source';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.form_section_field_types
    WHERE field_key = 'lead_source'
  ) THEN
    INSERT INTO public.form_section_field_types (
      section_type,
      field_key,
      field_label,
      field_type,
      is_sticky,
      is_system_required,
      order_index,
      created_at,
      updated_at
    ) VALUES (
      'quotedDetails',
      'lead_source',
      'Lead Source',
      'select',
      true,
      true,
      2,
      now(),
      now()
    );
  ELSE
    RAISE NOTICE 'lead_source exists in another section; skipping quotedDetails insert until constraint is normalized.';
  END IF;
END $$;

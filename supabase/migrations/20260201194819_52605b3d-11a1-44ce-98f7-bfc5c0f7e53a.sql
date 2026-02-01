-- Fix Discovery flow apply_category question
-- The question is currently type "textarea" but should be "select" for domain selection
UPDATE flow_templates 
SET questions_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'id' = 'apply_category' THEN 
        jsonb_build_object(
          'id', 'apply_category',
          'type', 'select',
          'prompt', 'What Category of life would you like to apply this discovery?',
          'options', jsonb_build_array('BALANCE', 'BODY', 'BEING', 'BUSINESS'),
          'required', true,
          'interpolation_key', 'apply_category'
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(questions_json) AS elem
),
updated_at = now()
WHERE slug = 'discovery';
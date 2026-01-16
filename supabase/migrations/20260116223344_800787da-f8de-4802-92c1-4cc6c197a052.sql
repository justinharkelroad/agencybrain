-- Backfill selectedKpiSlug for forms that have selectedKpiId but no slug
-- This ensures all forms have the slug fallback available for healing
-- Note: kpis table uses 'key' column as the slug

UPDATE form_templates ft
SET schema_json = (
  SELECT jsonb_set(
    ft.schema_json,
    '{kpis}',
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE 
            WHEN elem->>'selectedKpiId' IS NOT NULL 
                 AND (elem->>'selectedKpiSlug' IS NULL OR elem->>'selectedKpiSlug' = '')
            THEN elem || jsonb_build_object('selectedKpiSlug', COALESCE(k.key, ''))
            ELSE elem
          END
          ORDER BY ordinality
        )
        FROM jsonb_array_elements(ft.schema_json->'kpis') WITH ORDINALITY AS arr(elem, ordinality)
        LEFT JOIN kpis k ON k.id = (elem->>'selectedKpiId')::uuid
      ),
      '[]'::jsonb
    )
  )
)
WHERE schema_json->'kpis' IS NOT NULL
  AND jsonb_array_length(schema_json->'kpis') > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(schema_json->'kpis') elem
    WHERE elem->>'selectedKpiId' IS NOT NULL 
      AND (elem->>'selectedKpiSlug' IS NULL OR elem->>'selectedKpiSlug' = '')
  );
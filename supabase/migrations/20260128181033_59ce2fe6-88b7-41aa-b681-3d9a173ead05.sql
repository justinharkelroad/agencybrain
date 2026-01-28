-- Fix duplicate KPI keys in Mayra's Service form
UPDATE form_templates
SET schema_json = jsonb_set(
  schema_json,
  '{kpis}',
  (
    SELECT jsonb_agg(
      CASE 
        -- Fix Renewals: change custom_kpi_3 to custom_kpi_5_renewals
        WHEN kpi->>'label' = 'Renewals' AND kpi->>'key' = 'custom_kpi_3'
        THEN jsonb_set(kpi, '{key}', '"custom_kpi_5_renewals"')
        -- Fix GFN: change custom_kpi_4 to custom_kpi_6_gfn  
        WHEN kpi->>'label' = 'GFN' AND kpi->>'key' = 'custom_kpi_4'
        THEN jsonb_set(kpi, '{key}', '"custom_kpi_6_gfn"')
        ELSE kpi
      END
    )
    FROM jsonb_array_elements(schema_json->'kpis') AS kpi
  )
),
updated_at = now()
WHERE id = '5fa72ac2-eb45-476e-9a51-02c4af959956';
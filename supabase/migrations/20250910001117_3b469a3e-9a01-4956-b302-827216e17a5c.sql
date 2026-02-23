-- Create missing KPI bindings for form templates
-- For form template 46a150a4-600d-449c-a48f-68b9458935f8 (Sales Scorecard)
INSERT INTO public.forms_kpi_bindings (form_template_id, kpi_version_id)
SELECT v.form_template_id, v.kpi_version_id
FROM (
  VALUES
    ('46a150a4-600d-449c-a48f-68b9458935f8'::uuid, 'bf8feed4-4342-4b4c-b98b-ec87c59d7c36'::uuid), -- outbound_calls
    ('46a150a4-600d-449c-a48f-68b9458935f8'::uuid, '515d86c6-a02b-4622-b120-c187c93c0af3'::uuid), -- talk_minutes
    ('46a150a4-600d-449c-a48f-68b9458935f8'::uuid, '1b9168a6-a691-49fc-acd4-84e6d3befcf1'::uuid), -- quoted_count
    ('46a150a4-600d-449c-a48f-68b9458935f8'::uuid, '74ac3991-7b05-4431-a091-fab21213200e'::uuid)  -- sold_items
) AS v(form_template_id, kpi_version_id)
WHERE EXISTS (SELECT 1 FROM public.form_templates ft WHERE ft.id = v.form_template_id)
  AND EXISTS (SELECT 1 FROM public.kpi_versions kv WHERE kv.id = v.kpi_version_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.forms_kpi_bindings fk
    WHERE fk.form_template_id = v.form_template_id
      AND fk.kpi_version_id = v.kpi_version_id
  );

-- For form template 58b59ac3-65f6-40ba-9c34-af66fabc0976 (Daily Sales Scorecard)
INSERT INTO public.forms_kpi_bindings (form_template_id, kpi_version_id)
SELECT v.form_template_id, v.kpi_version_id
FROM (
  VALUES
    ('58b59ac3-65f6-40ba-9c34-af66fabc0976'::uuid, 'bf8feed4-4342-4b4c-b98b-ec87c59d7c36'::uuid), -- outbound_calls
    ('58b59ac3-65f6-40ba-9c34-af66fabc0976'::uuid, '515d86c6-a02b-4622-b120-c187c93c0af3'::uuid), -- talk_minutes
    ('58b59ac3-65f6-40ba-9c34-af66fabc0976'::uuid, '1b9168a6-a691-49fc-acd4-84e6d3befcf1'::uuid), -- quoted_count
    ('58b59ac3-65f6-40ba-9c34-af66fabc0976'::uuid, '74ac3991-7b05-4431-a091-fab21213200e'::uuid)  -- sold_items
) AS v(form_template_id, kpi_version_id)
WHERE EXISTS (SELECT 1 FROM public.form_templates ft WHERE ft.id = v.form_template_id)
  AND EXISTS (SELECT 1 FROM public.kpi_versions kv WHERE kv.id = v.kpi_version_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.forms_kpi_bindings fk
    WHERE fk.form_template_id = v.form_template_id
      AND fk.kpi_version_id = v.kpi_version_id
  );

-- Create missing KPI bindings for form templates
-- For form template 46a150a4-600d-449c-a48f-68b9458935f8 (Sales Scorecard)
INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
VALUES 
  ('46a150a4-600d-449c-a48f-68b9458935f8', 'bf8feed4-4342-4b4c-b98b-ec87c59d7c36'), -- outbound_calls
  ('46a150a4-600d-449c-a48f-68b9458935f8', '515d86c6-a02b-4622-b120-c187c93c0af3'), -- talk_minutes  
  ('46a150a4-600d-449c-a48f-68b9458935f8', '1b9168a6-a691-49fc-acd4-84e6d3befcf1'), -- quoted_count
  ('46a150a4-600d-449c-a48f-68b9458935f8', '74ac3991-7b05-4431-a091-fab21213200e'); -- sold_items

-- For form template 58b59ac3-65f6-40ba-9c34-af66fabc0976 (Daily Sales Scorecard)
INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
VALUES 
  ('58b59ac3-65f6-40ba-9c34-af66fabc0976', 'bf8feed4-4342-4b4c-b98b-ec87c59d7c36'), -- outbound_calls
  ('58b59ac3-65f6-40ba-9c34-af66fabc0976', '515d86c6-a02b-4622-b120-c187c93c0af3'), -- talk_minutes
  ('58b59ac3-65f6-40ba-9c34-af66fabc0976', '1b9168a6-a691-49fc-acd4-84e6d3befcf1'), -- quoted_count
  ('58b59ac3-65f6-40ba-9c34-af66fabc0976', '74ac3991-7b05-4431-a091-fab21213200e'); -- sold_items
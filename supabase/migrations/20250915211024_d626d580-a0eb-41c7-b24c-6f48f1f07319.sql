-- Create a new test submission with current timestamp
INSERT INTO submissions (
  id,
  form_template_id, 
  team_member_id,
  submission_date,
  work_date,
  payload_json,
  final
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM form_templates WHERE slug = 'sales-scorecard-new' AND agency_id = (SELECT id FROM agencies WHERE slug = 'hfi-inc')),
  'e3fbc8f4-beca-4d65-b1be-9b5bb2b2a2a8',
  CURRENT_DATE,
  CURRENT_DATE,
  '{"outbound_calls": 175, "talk_minutes": 125, "quoted_count": 2, "sold_items": 1, "quoted_details": [{"prospect_name": "Final Test Prospect", "lead_source_id": "1262c038-c548-42be-aae0-9c99e2cacb0a", "detailed_notes": "Final pipeline test"}]}'::jsonb,
  false
) RETURNING id;
-- Create a new test submission with valid team member ID
INSERT INTO submissions (
  id,
  form_template_id, 
  team_member_id,
  submission_date,
  work_date,
  payload_json,
  final
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  (SELECT id FROM form_templates WHERE slug = 'sales-scorecard-new' AND agency_id = (SELECT id FROM agencies WHERE slug = 'hfi-inc')),
  '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316',
  CURRENT_DATE,
  CURRENT_DATE,
  '{"outbound_calls": 175, "talk_minutes": 125, "quoted_count": 2, "sold_items": 1, "quoted_details": [{"prospect_name": "Final Test Prospect", "lead_source_id": "1262c038-c548-42be-aae0-9c99e2cacb0a", "detailed_notes": "Final pipeline test"}]}'::jsonb,
  false
);
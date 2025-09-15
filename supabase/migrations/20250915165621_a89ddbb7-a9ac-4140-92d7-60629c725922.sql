-- Test submission for end-to-end proof
INSERT INTO submissions (
  form_template_id, 
  team_member_id, 
  submission_date, 
  work_date, 
  late, 
  final, 
  payload_json
) VALUES (
  'd30656ec-eee6-46e2-8d77-77388c804323',
  '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316',
  CURRENT_DATE,
  CURRENT_DATE,
  false,
  false,
  '{
    "outbound_calls": 172,
    "talk_minutes": 122,
    "sold_items": 1,
    "quoted_count": 1,
    "quoted_details": [{
      "prospect_name": "Test Prospect",
      "lead_source_id": "1262c038-c548-42be-aae0-9c99e2cacb0a",
      "detailed_notes": "End-to-end test submission"
    }]
  }'::jsonb
);
-- Remove incorrectly added 'with' from flow_templates questions_json
UPDATE flow_templates 
SET questions_json = REPLACE(
  REPLACE(questions_json::text, 'are you Flowing with', 'are you Flowing'),
  'are you flowing with', 'are you flowing'
)::jsonb
WHERE questions_json::text ILIKE '%flowing with%';
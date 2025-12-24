-- Update "stack" terminology to "flow" in flow_templates questions_json
UPDATE flow_templates 
SET questions_json = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(questions_json::text, 'stack_title', 'flow_title'),
        'are you Stacking', 'are you Flowing with'
      ),
      'are you stacking', 'are you flowing with'
    ),
    'from this Stack', 'from this Flow'
  ),
  'this Gratitude Stack', 'this Gratitude Flow'
)::jsonb
WHERE questions_json::text ILIKE '%stack%';
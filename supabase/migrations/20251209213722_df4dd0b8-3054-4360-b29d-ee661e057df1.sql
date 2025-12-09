
-- Update Grateful template
UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{0,prompt}',
  '"Welcome to your Gratitude Flow. To begin, give this reflection a title that captures what you''re grateful for today."'
)
WHERE slug = 'grateful';

UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{14,prompt}',
  '"You''ve just completed a powerful gratitude reflection. One last question: What is ONE specific action you will take within the next 24 hours to express this gratitude, honor your values, or pursue your goal?"'
)
WHERE slug = 'grateful';

-- Update Idea template
UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{0,prompt}',
  '"Welcome to your Idea Flow. To begin, give this idea a title that captures its essence."'
)
WHERE slug = 'idea';

UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{9,prompt}',
  '"You''ve just completed a powerful idea exploration. One last question: What is ONE specific action you will take within the next 24 hours to move this idea forward?"'
)
WHERE slug = 'idea';

-- Update War template
UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{0,prompt}',
  '"Welcome to your War Flow. To begin, give this challenge a title that captures what you''re facing."'
)
WHERE slug = 'war';

UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{9,prompt}',
  '"You''ve just completed a powerful strategic planning session. One last question: What is ONE specific action you will take within the next 24 hours to begin your campaign?"'
)
WHERE slug = 'war';

-- Update Irritation template
UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{0,prompt}',
  '"Welcome to your Irritation Flow. To begin, give this frustration a title that captures what''s bothering you."'
)
WHERE slug = 'irritation';

UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{9,prompt}',
  '"You''ve just completed a powerful irritation transformation. One last question: What is ONE specific action you will take within the next 24 hours to address this situation constructively?"'
)
WHERE slug = 'irritation';

-- Update Discovery template
UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{0,prompt}',
  '"Welcome to your Discovery Flow. To begin, give this learning a title that captures what you''ve discovered."'
)
WHERE slug = 'discovery';

UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{9,prompt}',
  '"You''ve just completed a powerful discovery integration. One last question: What is ONE specific action you will take within the next 24 hours to apply this learning?"'
)
WHERE slug = 'discovery';

-- Update Prayer template
UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{0,prompt}',
  '"Welcome to your Prayer Flow. To begin, give this prayer intention a title."'
)
WHERE slug = 'prayer';

UPDATE flow_templates 
SET questions_json = jsonb_set(
  questions_json,
  '{9,prompt}',
  '"You''ve just completed a meaningful prayer reflection. One last question: What is ONE specific action you will take within the next 24 hours to live out this prayer?"'
)
WHERE slug = 'prayer';

INSERT INTO flow_templates (name, slug, description, icon, color, questions_json, ai_challenge_enabled, ai_challenge_intensity, is_active, display_order)
VALUES (
  'Discovery',
  'discovery',
  'Capture key learnings and insights, then apply them intentionally to your life domains.',
  '🔍',
  '#8b5cf6',
  '[
    {
      "id": "title",
      "type": "text",
      "prompt": "What are you going to title this Discovery Stack?",
      "required": true,
      "interpolation_key": "stack_title"
    },
    {
      "id": "domain",
      "type": "select",
      "prompt": "What domain of CORE 4 are you Stacking?",
      "options": ["BALANCE", "BODY", "BEING", "BUSINESS"],
      "required": true
    },
    {
      "id": "trigger",
      "type": "textarea",
      "prompt": "Who/What are you stacking?",
      "required": true,
      "interpolation_key": "trigger",
      "placeholder": "Describe the experience, training, event, or insight source..."
    },
    {
      "id": "discovery_activated",
      "type": "textarea",
      "prompt": "In this moment, what Discovery has {trigger} activated in you?",
      "required": true,
      "ai_challenge": true,
      "placeholder": "What have you discovered or realized?"
    },
    {
      "id": "story",
      "type": "textarea",
      "prompt": "What is the story you are telling yourself about this discovery?",
      "required": true,
      "interpolation_key": "story"
    },
    {
      "id": "feelings",
      "type": "text",
      "prompt": "Describe the single word feelings that arise for you when you tell yourself that story?",
      "required": true,
      "placeholder": "e.g., Inspired, Enlightened, Motivated..."
    },
    {
      "id": "thoughts_actions",
      "type": "textarea",
      "prompt": "Describe the specific thoughts and actions that arise for you when you tell yourself this story?",
      "required": true
    },
    {
      "id": "why_positive",
      "type": "textarea",
      "prompt": "Stepping back from what you have discovered, why has this discovery been extremely positive?",
      "required": true
    },
    {
      "id": "lesson",
      "type": "textarea",
      "prompt": "Looking at how positive this discovery trigger has been, what is the singular lesson about life you are taking from this Stack?",
      "required": true,
      "interpolation_key": "lesson"
    },
    {
      "id": "apply_category",
      "type": "select",
      "prompt": "What Category of life would you like to apply this discovery?",
      "options": ["BALANCE", "BODY", "BEING", "BUSINESS"],
      "required": true,
      "interpolation_key": "apply_category"
    },
    {
      "id": "apply_lesson",
      "type": "textarea",
      "prompt": "The lesson you learned was \"{lesson}\" - How does this lesson apply to your {apply_category} domain?",
      "required": true
    },
    {
      "id": "revelation",
      "type": "textarea",
      "prompt": "What is the most significant REVELATION or INSIGHT you are leaving this Discovery Stack with, and why do you feel that way?",
      "required": true,
      "ai_challenge": true
    },
    {
      "id": "actions",
      "type": "textarea",
      "prompt": "What immediate actions are you committed to taking leaving this Stack?",
      "required": true,
      "ai_challenge": true
    }
  ]'::jsonb,
  true,
  'gentle',
  true,
  5
)
ON CONFLICT (slug) DO UPDATE SET
  questions_json = EXCLUDED.questions_json,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  updated_at = now();
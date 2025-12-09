INSERT INTO flow_templates (name, slug, description, icon, color, questions_json, ai_challenge_enabled, ai_challenge_intensity, is_active, display_order)
VALUES (
  'Prayer',
  'prayer',
  'Invite God into your situation through intentional prayer and reflection.',
  '🙏',
  '#3b82f6',
  '[
    {
      "id": "title",
      "type": "text",
      "prompt": "What are you going to title this Prayer Stack?",
      "required": true,
      "interpolation_key": "stack_title"
    },
    {
      "id": "trigger",
      "type": "textarea",
      "prompt": "Who or what are you stacking?",
      "required": true,
      "interpolation_key": "trigger",
      "placeholder": "Describe the situation, event, person, or circumstance..."
    },
    {
      "id": "why_pray",
      "type": "textarea",
      "prompt": "In this moment, why has {trigger} triggered you to pray?",
      "required": true,
      "ai_challenge": true,
      "placeholder": "What is drawing you to prayer right now?"
    },
    {
      "id": "story",
      "type": "textarea",
      "prompt": "What is the story you are telling yourself, created by this trigger, about {trigger} and the situation?",
      "required": true,
      "interpolation_key": "story"
    },
    {
      "id": "feelings",
      "type": "text",
      "prompt": "Describe the single word feelings that arise for you when you tell yourself that story?",
      "required": true,
      "placeholder": "e.g., Excited, Loved, Hopeful, Peaceful..."
    },
    {
      "id": "god_know_1",
      "type": "textarea",
      "prompt": "I want GOD to know...",
      "required": true,
      "placeholder": "Share what is on your heart..."
    },
    {
      "id": "god_know_2",
      "type": "textarea",
      "prompt": "I want GOD to know...",
      "required": true,
      "placeholder": "Continue sharing with God..."
    },
    {
      "id": "god_know_3",
      "type": "textarea",
      "prompt": "I want GOD to know...",
      "required": true,
      "placeholder": "What else do you want God to know?"
    },
    {
      "id": "god_know_4",
      "type": "textarea",
      "prompt": "I want GOD to know...",
      "required": true,
      "placeholder": "One more thing for God..."
    },
    {
      "id": "dear_god",
      "type": "textarea",
      "prompt": "Dear GOD,",
      "required": true,
      "placeholder": "Write your prayer freely... praise, thanks, requests, whatever is on your heart..."
    },
    {
      "id": "lesson",
      "type": "textarea",
      "prompt": "What is the singular lesson on life you are taking from this Prayer Stack?",
      "required": true
    },
    {
      "id": "revelation",
      "type": "textarea",
      "prompt": "What is the most significant REVELATION or INSIGHT you are leaving this Prayer Stack with, and why do you feel that way?",
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
  6
)
ON CONFLICT (slug) DO UPDATE SET
  questions_json = EXCLUDED.questions_json,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  updated_at = now();
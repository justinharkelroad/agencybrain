INSERT INTO flow_templates (name, slug, description, icon, color, questions_json, ai_challenge_enabled, ai_challenge_intensity, is_active, display_order)
VALUES (
  'Idea',
  'idea',
  'Transform productive ideas into actionable plans with clarity and purpose.',
  '💡',
  '#eab308',
  '[
    {
      "id": "title",
      "type": "text",
      "prompt": "What are you going to title this Idea Stack?",
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
      "placeholder": "Describe the idea, project, or opportunity..."
    },
    {
      "id": "idea_activated",
      "type": "textarea",
      "prompt": "In this moment, what Idea has {trigger} activated in you?",
      "required": true,
      "ai_challenge": true,
      "placeholder": "Describe the idea that has come to mind..."
    },
    {
      "id": "story",
      "type": "textarea",
      "prompt": "What is the story you are telling yourself about this new idea?",
      "required": true,
      "interpolation_key": "story"
    },
    {
      "id": "feelings",
      "type": "text",
      "prompt": "Describe the single word feelings that arise for you when you tell yourself that story?",
      "required": true,
      "placeholder": "e.g., Excited, Inspired, Driven..."
    },
    {
      "id": "thoughts_actions",
      "type": "textarea",
      "prompt": "Describe the specific thoughts and actions that arise for you when you tell yourself this story?",
      "required": true
    },
    {
      "id": "positive_benefits",
      "type": "textarea",
      "prompt": "If this productive idea is executed on, what are the positive benefits to your world and those you are connected to?",
      "required": true
    },
    {
      "id": "negative_effects",
      "type": "textarea",
      "prompt": "If this productive idea is not executed on, what are the possible negative side effects to your world and those you are connected to?",
      "required": true
    },
    {
      "id": "fact_1",
      "type": "textarea",
      "prompt": "What is the first measurable FACT?",
      "required": true
    },
    {
      "id": "fact_1_why",
      "type": "textarea",
      "prompt": "Why do you feel selecting this FACT is significant?",
      "required": true
    },
    {
      "id": "fact_1_title",
      "type": "text",
      "prompt": "What is a simple TITLE you could give this FACT?",
      "required": true
    },
    {
      "id": "fact_2",
      "type": "textarea",
      "prompt": "What is the second measurable FACT?",
      "required": true
    },
    {
      "id": "fact_2_why",
      "type": "textarea",
      "prompt": "Why do you feel selecting this FACT is significant?",
      "required": true
    },
    {
      "id": "fact_2_title",
      "type": "text",
      "prompt": "What is a simple TITLE you could give this FACT?",
      "required": true
    },
    {
      "id": "fact_3",
      "type": "textarea",
      "prompt": "What is the third measurable FACT?",
      "required": true
    },
    {
      "id": "fact_3_why",
      "type": "textarea",
      "prompt": "Why do you feel selecting this FACT is significant?",
      "required": true
    },
    {
      "id": "fact_3_title",
      "type": "text",
      "prompt": "What is a simple TITLE you could give this FACT?",
      "required": true
    },
    {
      "id": "fact_4",
      "type": "textarea",
      "prompt": "What is the fourth measurable FACT?",
      "required": true
    },
    {
      "id": "fact_4_why",
      "type": "textarea",
      "prompt": "Why do you feel selecting this FACT is significant?",
      "required": true
    },
    {
      "id": "fact_4_title",
      "type": "text",
      "prompt": "What is a simple TITLE you could give this FACT?",
      "required": true
    },
    {
      "id": "why_positive",
      "type": "textarea",
      "prompt": "Stepping back from this Idea Stack, why has this productive idea been extremely positive?",
      "required": true
    },
    {
      "id": "lesson",
      "type": "textarea",
      "prompt": "Looking at how positive this productive idea has been, what is the singular lesson about life you are taking from this Stack?",
      "required": true
    },
    {
      "id": "revelation",
      "type": "textarea",
      "prompt": "What is the most significant REVELATION or INSIGHT you are leaving this Idea Stack with, and why do you feel that way?",
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
  2
)
ON CONFLICT (slug) DO UPDATE SET
  questions_json = EXCLUDED.questions_json,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  updated_at = now();
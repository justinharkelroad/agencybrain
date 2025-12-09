INSERT INTO flow_templates (name, slug, description, icon, color, questions_json, ai_challenge_enabled, ai_challenge_intensity, is_active, display_order)
VALUES (
  'Irritation',
  'irritation',
  'Transform irritation into clarity by reframing your story and finding the positive path forward.',
  '😤',
  '#f97316',
  '[
    {
      "id": "title",
      "type": "text",
      "prompt": "What are you going to title this Irritation Stack?",
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
      "prompt": "Who/What are you Stacking?",
      "required": true,
      "interpolation_key": "trigger",
      "placeholder": "Describe the person, situation, or thing causing irritation..."
    },
    {
      "id": "why_irritated",
      "type": "textarea",
      "prompt": "In this moment, why has {trigger} triggered you to feel irritated?",
      "required": true,
      "ai_challenge": true,
      "placeholder": "Be honest about what is bothering you..."
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
      "prompt": "Describe the single word FEELINGS that arise for you when you tell yourself that story?",
      "required": true,
      "placeholder": "e.g., Hurt, Frustrated, Disappointed..."
    },
    {
      "id": "thoughts_actions",
      "type": "textarea",
      "prompt": "Describe the specific thoughts and actions that arise for you when you tell yourself this story?",
      "required": true
    },
    {
      "id": "evidence_true",
      "type": "textarea",
      "prompt": "What evidence do you have to support this story as absolutely true?",
      "required": true
    },
    {
      "id": "facts",
      "type": "textarea",
      "prompt": "What are the non-emotional FACTS about the situation with {trigger} that triggered you to feel irritated?",
      "required": true
    },
    {
      "id": "ignore_consequence",
      "type": "textarea",
      "prompt": "If you ignore this current irritation, how will it lead to anger and eventually rage?",
      "required": true
    },
    {
      "id": "want_for_you",
      "type": "textarea",
      "prompt": "Regardless of your irritation trigger with {trigger} and the original story \"{story}\" that you are telling yourself, what do you truly want for you in and beyond this situation?",
      "required": true,
      "interpolation_key": "want_for_you"
    },
    {
      "id": "want_for_trigger",
      "type": "textarea",
      "prompt": "What do you want for {trigger} in and beyond this situation?",
      "required": true
    },
    {
      "id": "want_for_both",
      "type": "textarea",
      "prompt": "What do you want for {trigger} and YOU in and beyond this situation?",
      "required": true
    },
    {
      "id": "story_check",
      "type": "select",
      "prompt": "Let us look at your original story \"{story}\" and what you say you want \"{want_for_you}\" - If you keep telling yourself this original story, will it ultimately give you what you want?",
      "options": ["YES", "NO"],
      "required": true
    },
    {
      "id": "ready_to_let_go",
      "type": "select",
      "prompt": "Are you ready to let go of the original story and expand your mind and reality around this trigger and create a new power story that will assure you get what you want?",
      "options": ["YES", "NO"],
      "required": true
    },
    {
      "id": "desired_story",
      "type": "textarea",
      "prompt": "Letting go of the original story \"{story}\" and reviewing what you want \"{want_for_you}\" and knowing you can ultimately create any story you desire, what is your new DESIRED VERSION of the story?",
      "required": true,
      "interpolation_key": "desired_story",
      "ai_challenge": true
    },
    {
      "id": "desired_evidence",
      "type": "textarea",
      "prompt": "What evidence can you see to prove this desired story is accurate so you can weaponize yourself to move forward today?",
      "required": true
    },
    {
      "id": "desired_story_check",
      "type": "select",
      "prompt": "Stepping back and reviewing what you want \"{want_for_you}\" - will telling yourself this desired story \"{desired_story}\" give you what you want?",
      "options": ["YES", "NO"],
      "required": true
    },
    {
      "id": "why_positive",
      "type": "textarea",
      "prompt": "Stepping back from what you have created so far, why has this irritation been extremely positive?",
      "required": true
    },
    {
      "id": "lesson",
      "type": "textarea",
      "prompt": "Looking at how positive this irritation trigger has been, what is the singular lesson on life you are taking from this Stack?",
      "required": true
    },
    {
      "id": "revelation",
      "type": "textarea",
      "prompt": "What is the most significant REVELATION or INSIGHT you are leaving this Irritation Stack with, and why do you feel that way?",
      "required": true,
      "ai_challenge": true
    },
    {
      "id": "feelings_now",
      "type": "text",
      "prompt": "Compared to how you felt when you started this Irritation Stack, what singular words would you use to describe how you feel now completing it?",
      "required": true,
      "placeholder": "e.g., Hopeful, Clear, Peaceful..."
    },
    {
      "id": "actions",
      "type": "textarea",
      "prompt": "What immediate actions are you committed to take leaving this Stack?",
      "required": true,
      "ai_challenge": true
    }
  ]'::jsonb,
  true,
  'gentle',
  true,
  4
)
ON CONFLICT (slug) DO UPDATE SET
  questions_json = EXCLUDED.questions_json,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  updated_at = now();
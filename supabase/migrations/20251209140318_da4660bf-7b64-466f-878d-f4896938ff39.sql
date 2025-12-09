INSERT INTO flow_templates (name, slug, description, icon, color, questions_json, ai_challenge_enabled, ai_challenge_intensity, is_active, display_order)
VALUES (
  'Bible',
  'bible',
  'Study scripture intentionally and apply God''s word to your life through START, STOP, and SUSTAIN reflections.',
  '📖',
  '#059669',
  '[
    {
      "id": "title",
      "type": "text",
      "prompt": "What are you going to title this Bible Stack?",
      "required": true,
      "interpolation_key": "stack_title"
    },
    {
      "id": "scripture",
      "type": "textarea",
      "prompt": "What scripture did you read today?",
      "required": true,
      "placeholder": "Paste or type the scripture passage you read..."
    },
    {
      "id": "what_you_see",
      "type": "textarea",
      "prompt": "In this moment, what did you SEE while reading?",
      "required": true,
      "ai_challenge": true,
      "placeholder": "What stood out to you? What is God showing you?"
    },
    {
      "id": "start_doing",
      "type": "select",
      "prompt": "From what you have seen... is there anything you must START doing?",
      "options": ["YES", "NO"],
      "required": true
    },
    {
      "id": "start_what",
      "type": "textarea",
      "prompt": "What does GOD want you to START doing this week?",
      "required": false,
      "placeholder": "If you answered YES above, describe what God wants you to start..."
    },
    {
      "id": "start_measure",
      "type": "textarea",
      "prompt": "How will you measure that you did that?",
      "required": false,
      "placeholder": "How will you know you followed through?"
    },
    {
      "id": "start_story",
      "type": "textarea",
      "prompt": "What story must you tell yourself to assure that you do it?",
      "required": false,
      "placeholder": "What mindset or belief will drive you?"
    },
    {
      "id": "stop_doing",
      "type": "select",
      "prompt": "From what you have seen... is there anything you must STOP doing?",
      "options": ["YES", "NO"],
      "required": true
    },
    {
      "id": "stop_what",
      "type": "textarea",
      "prompt": "What does GOD want you to STOP doing this week?",
      "required": false,
      "placeholder": "If you answered YES above, describe what God wants you to stop..."
    },
    {
      "id": "stop_measure",
      "type": "textarea",
      "prompt": "How will you measure that you did that?",
      "required": false,
      "placeholder": "How will you know you followed through?"
    },
    {
      "id": "stop_story",
      "type": "textarea",
      "prompt": "What story must you tell yourself to assure that you do it?",
      "required": false,
      "placeholder": "What mindset or belief will drive you?"
    },
    {
      "id": "sustain_doing",
      "type": "select",
      "prompt": "From what you have seen... is there anything you must SUSTAIN doing?",
      "options": ["YES", "NO"],
      "required": true
    },
    {
      "id": "sustain_what",
      "type": "textarea",
      "prompt": "What does GOD want you to SUSTAIN doing this week?",
      "required": false,
      "placeholder": "If you answered YES above, describe what God wants you to sustain..."
    },
    {
      "id": "sustain_measure",
      "type": "textarea",
      "prompt": "How will you measure that you did that?",
      "required": false,
      "placeholder": "How will you know you followed through?"
    },
    {
      "id": "sustain_story",
      "type": "textarea",
      "prompt": "What story must you tell yourself to assure that you do it?",
      "required": false,
      "placeholder": "What mindset or belief will drive you?"
    },
    {
      "id": "lesson",
      "type": "textarea",
      "prompt": "Looking at how positive this Bible Study has been, what is the singular lesson about life you are taking from this Stack?",
      "required": true
    },
    {
      "id": "revelation",
      "type": "textarea",
      "prompt": "What is the most significant REVELATION or INSIGHT you are leaving this Scripture Study with?",
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
  7
)
ON CONFLICT (slug) DO UPDATE SET
  questions_json = EXCLUDED.questions_json,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  updated_at = now();
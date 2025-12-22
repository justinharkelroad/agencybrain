UPDATE flow_templates 
SET questions_json = '[
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
    "placeholder": "What stood out to you? What is God showing you?",
    "ai_challenge": true
  },
  {
    "id": "start_doing",
    "type": "select",
    "prompt": "From what you have seen... is there anything you must START doing?",
    "required": true,
    "options": ["YES", "NO"]
  },
  {
    "id": "start_what",
    "type": "textarea",
    "prompt": "What does GOD want you to START doing this week?",
    "required": false,
    "placeholder": "If you answered YES above, describe what God wants you to start...",
    "show_if": { "question_id": "start_doing", "equals": "YES" }
  },
  {
    "id": "start_measure",
    "type": "textarea",
    "prompt": "How will you measure that you did that?",
    "required": false,
    "placeholder": "How will you know you followed through?",
    "show_if": { "question_id": "start_doing", "equals": "YES" }
  },
  {
    "id": "start_story",
    "type": "textarea",
    "prompt": "What story must you tell yourself to assure that you do it?",
    "required": false,
    "placeholder": "What mindset or belief will drive you?",
    "show_if": { "question_id": "start_doing", "equals": "YES" }
  },
  {
    "id": "stop_doing",
    "type": "select",
    "prompt": "From what you have seen... is there anything you must STOP doing?",
    "required": true,
    "options": ["YES", "NO"]
  },
  {
    "id": "stop_what",
    "type": "textarea",
    "prompt": "What does GOD want you to STOP doing this week?",
    "required": false,
    "placeholder": "If you answered YES above, describe what God wants you to stop...",
    "show_if": { "question_id": "stop_doing", "equals": "YES" }
  },
  {
    "id": "stop_measure",
    "type": "textarea",
    "prompt": "How will you measure that you did that?",
    "required": false,
    "placeholder": "How will you know you followed through?",
    "show_if": { "question_id": "stop_doing", "equals": "YES" }
  },
  {
    "id": "stop_story",
    "type": "textarea",
    "prompt": "What story must you tell yourself to assure that you do it?",
    "required": false,
    "placeholder": "What mindset or belief will drive you?",
    "show_if": { "question_id": "stop_doing", "equals": "YES" }
  },
  {
    "id": "sustain_doing",
    "type": "select",
    "prompt": "From what you have seen... is there anything you must SUSTAIN doing?",
    "required": true,
    "options": ["YES", "NO"]
  },
  {
    "id": "sustain_what",
    "type": "textarea",
    "prompt": "What does GOD want you to SUSTAIN doing this week?",
    "required": false,
    "placeholder": "If you answered YES above, describe what God wants you to sustain...",
    "show_if": { "question_id": "sustain_doing", "equals": "YES" }
  },
  {
    "id": "sustain_measure",
    "type": "textarea",
    "prompt": "How will you measure that you did that?",
    "required": false,
    "placeholder": "How will you know you followed through?",
    "show_if": { "question_id": "sustain_doing", "equals": "YES" }
  },
  {
    "id": "sustain_story",
    "type": "textarea",
    "prompt": "What story must you tell yourself to assure that you do it?",
    "required": false,
    "placeholder": "What mindset or belief will drive you?",
    "show_if": { "question_id": "sustain_doing", "equals": "YES" }
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
]'::jsonb
WHERE slug = 'bible';
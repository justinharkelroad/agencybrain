-- ============================================
-- FLOWS FEATURE - DATABASE SCHEMA
-- ============================================

-- User profile/context for AI personalization
CREATE TABLE IF NOT EXISTS flow_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  full_name TEXT,
  preferred_name TEXT,
  
  -- Life context
  life_roles TEXT[], -- ['spouse', 'parent', 'business owner', 'coach']
  core_values TEXT[], -- ['faith', 'family', 'growth', 'impact']
  current_goals TEXT,
  current_challenges TEXT,
  
  -- Beliefs (for Bible/Prayer stacks)
  spiritual_beliefs TEXT,
  faith_tradition TEXT,
  
  -- Additional context
  background_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Flow templates (Admin-managed)
CREATE TABLE IF NOT EXISTS flow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  
  -- Questions configuration (JSONB array)
  questions_json JSONB NOT NULL DEFAULT '[]',
  
  -- AI settings
  ai_challenge_enabled BOOLEAN DEFAULT true,
  ai_challenge_intensity TEXT DEFAULT 'gentle',
  ai_analysis_prompt TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Completed flow sessions (user's stacks)
CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_template_id UUID NOT NULL REFERENCES flow_templates(id),
  
  -- Session data
  title TEXT,
  domain TEXT,
  
  -- All responses (JSONB object)
  responses_json JSONB NOT NULL DEFAULT '{}',
  
  -- AI analysis (JSONB object)
  ai_analysis_json JSONB,
  
  -- Status
  status TEXT DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  
  -- Export
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI challenge interaction logs
CREATE TABLE IF NOT EXISTS flow_challenge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES flow_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  original_response TEXT,
  ai_challenge TEXT,
  user_action TEXT,
  revised_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_profiles_user ON flow_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_user ON flow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_template ON flow_sessions(flow_template_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_status ON flow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_created ON flow_sessions(created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE flow_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_challenge_logs ENABLE ROW LEVEL SECURITY;

-- flow_profiles: Users can only see/edit their own
CREATE POLICY "users_own_flow_profile" ON flow_profiles
  FOR ALL USING (auth.uid() = user_id);

-- flow_templates: Only authenticated users can read active templates
CREATE POLICY "authenticated_can_read_active_templates" ON flow_templates
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- flow_templates: Only admin can manage
CREATE POLICY "admin_can_manage_templates" ON flow_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- flow_sessions: Users can only see/edit their own
CREATE POLICY "users_own_flow_sessions" ON flow_sessions
  FOR ALL USING (auth.uid() = user_id);

-- flow_challenge_logs: Users can only see their own (via session ownership)
CREATE POLICY "users_own_challenge_logs" ON flow_challenge_logs
  FOR ALL USING (
    session_id IN (SELECT id FROM flow_sessions WHERE user_id = auth.uid())
  );

-- ============================================
-- SEED: GRATEFUL STACK TEMPLATE
-- ============================================

INSERT INTO flow_templates (name, slug, description, icon, color, questions_json, ai_challenge_enabled, display_order)
VALUES (
  'Grateful',
  'grateful',
  'Transform moments of gratitude into deeper insights and actionable growth.',
  '🙏',
  '#22c55e',
  '[
    {
      "id": "title",
      "type": "text",
      "prompt": "What are you going to title this Gratitude Stack?",
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
      "placeholder": "Describe the person, event, or thing you are grateful for..."
    },
    {
      "id": "why_grateful",
      "type": "textarea",
      "prompt": "In this moment, why has {trigger} triggered you to feel grateful?",
      "required": true,
      "ai_challenge": true,
      "placeholder": "Take your time. Speak or type freely about why this makes you grateful..."
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
      "placeholder": "e.g., Happy, Peaceful, Blessed, Content..."
    },
    {
      "id": "thoughts_actions",
      "type": "textarea",
      "prompt": "Describe the specific thoughts and actions that arise for you when you tell yourself this story?",
      "required": true
    },
    {
      "id": "facts",
      "type": "textarea",
      "prompt": "What are the non-emotional FACTS about the situation with {trigger} that triggered you to feel grateful?",
      "required": true
    },
    {
      "id": "want_for_you",
      "type": "textarea",
      "prompt": "Empowered by your gratitude trigger with {trigger} and the original story \"{story}\" you are telling yourself, what do you truly want for you in and beyond this situation?",
      "required": true
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
      "id": "why_positive",
      "type": "textarea",
      "prompt": "Stepping back from what you have created so far, why has this gratitude trigger been extremely positive?",
      "required": true
    },
    {
      "id": "lesson",
      "type": "textarea",
      "prompt": "Looking at how positive this gratitude trigger has been, what is the singular lesson on life you are taking from this Stack?",
      "required": true
    },
    {
      "id": "revelation",
      "type": "textarea",
      "prompt": "What is the most significant REVELATION or INSIGHT you are leaving this Gratitude Stack with, and why do you feel that way?",
      "required": true,
      "ai_challenge": true
    },
    {
      "id": "actions",
      "type": "textarea",
      "prompt": "What immediate ACTIONS are you committed to taking leaving this Stack?",
      "required": true,
      "ai_challenge": true
    }
  ]'::jsonb,
  true,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  questions_json = EXCLUDED.questions_json,
  updated_at = now();
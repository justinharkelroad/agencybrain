-- ============================================
-- SUGGESTED QUESTIONS TABLE
-- ============================================

CREATE TABLE public.chatbot_suggested_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_route TEXT NOT NULL,
  question TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  applies_to_portals TEXT[] DEFAULT '{both}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_suggested_questions_route ON public.chatbot_suggested_questions (page_route);
CREATE INDEX idx_suggested_questions_active ON public.chatbot_suggested_questions (is_active);

-- Enable RLS
ALTER TABLE public.chatbot_suggested_questions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active questions
CREATE POLICY "Anyone can read active suggested questions" ON public.chatbot_suggested_questions
  FOR SELECT USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage suggested questions" ON public.chatbot_suggested_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_chatbot_suggested_questions_updated_at
  BEFORE UPDATE ON public.chatbot_suggested_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DEFAULT QUESTIONS
-- ============================================

INSERT INTO public.chatbot_suggested_questions (page_route, question, sort_order, applies_to_portals, is_active) VALUES
-- Dashboard (Brain Portal)
('/dashboard', 'What do my dashboard metrics mean?', 1, ARRAY['brain'], true),
('/dashboard', 'How do I submit my reporting period?', 2, ARRAY['brain'], true),
('/dashboard', 'Where do I manage my team?', 3, ARRAY['brain'], true),

-- Submit
('/submit', 'What goes in each section?', 1, ARRAY['brain'], true),
('/submit', 'Does my data auto-save?', 2, ARRAY['brain'], true),
('/submit', 'What is the qualitative section for?', 3, ARRAY['brain'], true),

-- Metrics
('/metrics', 'How do I create a scorecard form?', 1, ARRAY['brain'], true),
('/metrics', 'Where can I see staff submissions?', 2, ARRAY['brain'], true),
('/metrics', 'How do I set KPI targets?', 3, ARRAY['brain'], true),

-- Agency
('/agency', 'How do I add a team member?', 1, ARRAY['brain'], true),
('/agency', 'How do I create staff logins?', 2, ARRAY['brain'], true),
('/agency', 'What are Key Employees?', 3, ARRAY['brain'], true),

-- Training (Brain)
('/training', 'What training is available?', 1, ARRAY['brain'], true),
('/training', 'How do I assign training to staff?', 2, ARRAY['brain'], true),
('/training', 'Where do I see staff progress?', 3, ARRAY['brain'], true),

-- Bonus Grid
('/bonus-grid', 'How does the Bonus Grid work?', 1, ARRAY['brain'], true),
('/bonus-grid', 'What are PPI values?', 2, ARRAY['brain'], true),
('/bonus-grid', 'How do I read the tier calculations?', 3, ARRAY['brain'], true),

-- Snapshot Planner
('/snapshot-planner', 'What is the Snapshot Planner?', 1, ARRAY['brain'], true),
('/snapshot-planner', 'How do I calculate my ROY targets?', 2, ARRAY['brain'], true),
('/snapshot-planner', 'What inputs do I need?', 3, ARRAY['brain'], true),

-- Call Scoring (Brain)
('/call-scoring', 'How do I upload a call?', 1, ARRAY['brain'], true),
('/call-scoring', 'What file formats are supported?', 2, ARRAY['brain'], true),
('/call-scoring', 'How are calls scored?', 3, ARRAY['brain'], true),

-- Roleplay Bot
('/roleplaybot', 'How do I start a roleplay session?', 1, ARRAY['brain'], true),
('/roleplaybot', 'What does the grading measure?', 2, ARRAY['brain'], true),
('/roleplaybot', 'Can my staff use this?', 3, ARRAY['brain'], true),

-- Exchange
('/exchange', 'What is The Exchange?', 1, ARRAY['brain'], true),
('/exchange', 'How do I create a post?', 2, ARRAY['brain'], true),
('/exchange', 'Who can see my posts?', 3, ARRAY['brain'], true),

-- Staff Dashboard
('/staff/dashboard', 'How do I submit my daily scorecard?', 1, ARRAY['staff'], true),
('/staff/dashboard', 'What are my focus targets?', 2, ARRAY['staff'], true),
('/staff/dashboard', 'Where is my training?', 3, ARRAY['staff'], true),

-- Staff Training
('/staff/training', 'How do I complete a lesson?', 1, ARRAY['staff'], true),
('/staff/training', 'What is Standard Playbook vs Agency Training?', 2, ARRAY['staff'], true),
('/staff/training', 'How do I track my progress?', 3, ARRAY['staff'], true),

-- Staff Call Scoring
('/staff/call-scoring', 'How do I upload my call?', 1, ARRAY['staff'], true),
('/staff/call-scoring', 'What file formats work?', 2, ARRAY['staff'], true),
('/staff/call-scoring', 'How do I see my scores?', 3, ARRAY['staff'], true),

-- Staff Core 4
('/staff/core4', 'What is Core 4?', 1, ARRAY['staff'], true),
('/staff/core4', 'How do I build my streak?', 2, ARRAY['staff'], true),
('/staff/core4', 'What are Monthly Missions?', 3, ARRAY['staff'], true),

-- Staff Flows
('/staff/flows', 'What are Flows?', 1, ARRAY['staff'], true),
('/staff/flows', 'How do I start a Flow?', 2, ARRAY['staff'], true),
('/staff/flows', 'What is my Flow Profile?', 3, ARRAY['staff'], true),

-- Default (used when no page-specific questions exist)
('_default', 'What can I do in Agency Brain?', 1, ARRAY['both'], true),
('_default', 'How do I navigate the platform?', 2, ARRAY['both'], true),
('_default', 'Where do I get help?', 3, ARRAY['both'], true);
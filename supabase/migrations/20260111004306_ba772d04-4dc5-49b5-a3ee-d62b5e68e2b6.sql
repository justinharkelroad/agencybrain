-- ============================================
-- PROACTIVE TIPS TABLE
-- ============================================

CREATE TABLE public.chatbot_proactive_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_route TEXT NOT NULL,
  tip_message TEXT NOT NULL,
  suggested_question TEXT,
  delay_seconds INTEGER DEFAULT 45,
  sort_order INTEGER DEFAULT 0,
  applies_to_portals TEXT[] DEFAULT '{both}',
  applies_to_tiers TEXT[] DEFAULT '{all}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_proactive_tips_route ON public.chatbot_proactive_tips (page_route);
CREATE INDEX idx_proactive_tips_active ON public.chatbot_proactive_tips (is_active);

-- Enable RLS
ALTER TABLE public.chatbot_proactive_tips ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active tips
CREATE POLICY "Anyone can read active proactive tips" ON public.chatbot_proactive_tips
  FOR SELECT USING (is_active = true);

-- Only admins can manage
CREATE POLICY "Admins can manage proactive tips" ON public.chatbot_proactive_tips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_chatbot_proactive_tips_updated_at
  BEFORE UPDATE ON public.chatbot_proactive_tips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DEFAULT PROACTIVE TIPS
-- ============================================

INSERT INTO public.chatbot_proactive_tips (page_route, tip_message, suggested_question, delay_seconds, applies_to_portals, applies_to_tiers, is_active) VALUES
('/dashboard', 'First time here? I can give you a quick tour!', 'Give me a quick tour of the dashboard', 60, ARRAY['brain'], ARRAY['all'], true),
('/submit', 'Need help filling out your reporting period?', 'What goes in each section of the submit form?', 45, ARRAY['brain'], ARRAY['all'], true),
('/bonus-grid', 'The Bonus Grid can be tricky. Want me to explain how it works?', 'How does the Bonus Grid work?', 30, ARRAY['brain'], ARRAY['1:1 Coaching'], true),
('/snapshot-planner', 'Need help understanding your ROY targets?', 'How do I use the Snapshot Planner?', 30, ARRAY['brain'], ARRAY['1:1 Coaching'], true),
('/agency', 'Looking to add team members or manage staff logins?', 'How do I add a team member?', 45, ARRAY['brain'], ARRAY['all'], true),
('/training', 'Want to learn how to assign training to your staff?', 'How do I assign training to staff?', 45, ARRAY['brain'], ARRAY['all'], true),
('/metrics', 'I can help you understand KPIs and scorecards!', 'How do I create a scorecard form?', 45, ARRAY['brain'], ARRAY['all'], true),
('/call-scoring', 'Need help uploading or understanding call scores?', 'How do I upload a call for scoring?', 30, ARRAY['brain'], ARRAY['all'], true),
('/roleplaybot', 'Ready to practice your sales pitch? I can explain how!', 'How do I start a roleplay session?', 30, ARRAY['brain'], ARRAY['1:1 Coaching'], true),
('/staff/dashboard', 'Need help navigating your dashboard?', 'What can I do from my dashboard?', 60, ARRAY['staff'], ARRAY['all'], true),
('/staff/training', 'Looking for training resources? I can point you in the right direction!', 'What training is available to me?', 45, ARRAY['staff'], ARRAY['all'], true),
('/staff/core4', 'Want to learn how Core 4 helps build great habits?', 'What is Core 4 and how does it work?', 30, ARRAY['staff'], ARRAY['all'], true),
('/staff/flows', 'Curious about Flows? They''re great for personal growth!', 'What are Flows and how do I use them?', 30, ARRAY['staff'], ARRAY['all'], true),
('/staff/call-scoring', 'Need help uploading your calls?', 'How do I upload a call?', 30, ARRAY['staff'], ARRAY['all'], true);
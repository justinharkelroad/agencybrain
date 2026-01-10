-- ============================================
-- STAN CHATBOT - PHASE 1: DATABASE TABLES
-- ============================================

-- Table 1: chatbot_faqs
CREATE TABLE public.chatbot_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,
  applies_to_portals TEXT[] DEFAULT '{both}',
  applies_to_roles TEXT[] DEFAULT '{owner,key_employee,manager,staff}',
  applies_to_tiers TEXT[] DEFAULT '{all}',
  page_context TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chatbot_faqs
CREATE INDEX idx_chatbot_faqs_keywords ON public.chatbot_faqs USING GIN (keywords);
CREATE INDEX idx_chatbot_faqs_category ON public.chatbot_faqs (category);
CREATE INDEX idx_chatbot_faqs_active ON public.chatbot_faqs (is_active);

-- Enable RLS on chatbot_faqs
ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active FAQs
CREATE POLICY "Anyone can read active FAQs" ON public.chatbot_faqs
  FOR SELECT USING (is_active = true);

-- Only admins can manage FAQs (insert, update, delete)
CREATE POLICY "Admins can manage FAQs" ON public.chatbot_faqs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Table 2: chatbot_conversations
CREATE TABLE public.chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_user_id UUID REFERENCES public.staff_users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  portal TEXT NOT NULL DEFAULT 'brain',
  messages JSONB DEFAULT '[]',
  current_page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT user_reference_check CHECK (user_id IS NOT NULL OR staff_user_id IS NOT NULL)
);

-- Indexes for chatbot_conversations
CREATE INDEX idx_chatbot_conversations_user ON public.chatbot_conversations (user_id);
CREATE INDEX idx_chatbot_conversations_staff ON public.chatbot_conversations (staff_user_id);
CREATE INDEX idx_chatbot_conversations_updated ON public.chatbot_conversations (updated_at DESC);

-- Enable RLS on chatbot_conversations
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON public.chatbot_conversations
  FOR SELECT USING (
    user_id = auth.uid() OR
    staff_user_id IN (
      SELECT id FROM public.staff_users WHERE staff_users.id = staff_user_id
    )
  );

-- Users can create their own conversations
CREATE POLICY "Users can create own conversations" ON public.chatbot_conversations
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR staff_user_id IS NOT NULL
  );

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations" ON public.chatbot_conversations
  FOR UPDATE USING (
    user_id = auth.uid() OR staff_user_id IS NOT NULL
  );

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations" ON public.chatbot_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Trigger for updated_at on chatbot_faqs
CREATE TRIGGER update_chatbot_faqs_updated_at
  BEFORE UPDATE ON public.chatbot_faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on chatbot_conversations
CREATE TRIGGER update_chatbot_conversations_updated_at
  BEFORE UPDATE ON public.chatbot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO public.chatbot_faqs (question, answer, keywords, category, applies_to_portals, applies_to_roles, applies_to_tiers, page_context, priority, is_active) VALUES
(
  'How do I submit my reporting period?',
  'To submit your reporting period, click on "Submit" in the sidebar. Fill out each section (Sales, Marketing, Operations, Retention, Cash Flow), and click Save. Your data auto-saves every 30 seconds, so you won''t lose your progress!',
  ARRAY['submit', 'reporting', 'period', 'save', 'data entry'],
  'submit',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/submit', '/dashboard'],
  10,
  true
),
(
  'Where can I manage my team members?',
  'Head to Agency in your sidebar, then click the Team tab. From there you can add team members, set their roles (Sales, Service, Hybrid, Manager), create Staff Portal logins, and manage Key Employees.',
  ARRAY['team', 'members', 'staff', 'add', 'manage', 'agency'],
  'agency',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/agency'],
  9,
  true
),
(
  'What training resources are available?',
  'Agency Brain offers two training tracks: Standard Playbook (pre-built curriculum with videos and quizzes) and Agency Training (custom content your agency owner creates). Access both from the Training section in your sidebar.',
  ARRAY['training', 'learn', 'courses', 'playbook', 'videos'],
  'training',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/training', '/staff/training'],
  9,
  true
),
(
  'How do I submit my daily scorecard?',
  'As a staff member, you can submit your daily scorecard from your Staff Dashboard. Look for the scorecard form or use the quick-submit link your agency owner provided. Make sure to submit before end of day!',
  ARRAY['scorecard', 'daily', 'submit', 'form'],
  'staff-portal',
  ARRAY['staff'],
  ARRAY['manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/dashboard'],
  10,
  true
),
(
  'Why can''t I see the Bonus Grid?',
  'The Bonus Grid is a feature available exclusively to 1:1 Coaching members. It helps calculate Allstate bonus tiers and production targets. If you''re interested in accessing this feature, reach out to info@standardplaybook.com about upgrading your membership.',
  ARRAY['bonus', 'grid', 'access', 'see', 'missing', 'cant'],
  'bonus-grid',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['Boardroom'],
  ARRAY['/bonus-grid', '/dashboard'],
  8,
  true
);
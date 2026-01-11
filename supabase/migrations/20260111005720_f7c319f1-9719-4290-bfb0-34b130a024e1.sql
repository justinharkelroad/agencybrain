-- ============================================
-- COMPLETE PROACTIVE TIPS COVERAGE
-- Add tips for all 24 missing pages
-- ============================================

INSERT INTO public.chatbot_proactive_tips 
  (page_route, tip_message, suggested_question, delay_seconds, applies_to_portals, applies_to_tiers, is_active) 
VALUES
  -- ==========================================
  -- BRAIN PORTAL ADDITIONS (16 pages)
  -- ==========================================
  
  ('/core4', 'Want to learn how Core 4 builds great habits?', 'What is Core 4 and how does it work?', 30, ARRAY['brain'], ARRAY['all'], true),
  ('/flows', 'Curious about Flows? Great for personal growth!', 'What are Flows and how do I use them?', 30, ARRAY['brain'], ARRAY['all'], true),
  ('/exchange', 'Want to connect with other agency owners?', 'What is The Exchange and how do I use it?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/life-targets', 'Ready to set your 90-day goals?', 'How do Life Targets work?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/explorer', 'Looking for scorecard forms and data?', 'How do I use the Explorer?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/targets', 'Need help setting up KPI targets?', 'How do I configure my targets?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/team-rings', 'Want to see your team''s performance rings?', 'How does the Team Rings view work?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/lqs-roadmap', 'Need help with your sales pipeline?', 'How does the LQS Roadmap work?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/renewals', 'Looking to manage your renewals?', 'How do I track renewals?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/cancel-audit', 'Need help auditing cancellations?', 'How does the Cancel Audit work?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/sales', 'Managing sales data? I can help!', 'How do I use the Sales dashboard?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/theta-talk-track', 'Ready to build your talk track?', 'How do I create a Theta Talk Track?', 30, ARRAY['brain'], ARRAY['all'], true),
  ('/uploads', 'Need help with file uploads?', 'How do uploads work?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/training/standard', 'Looking for specific training content?', 'How do I navigate Standard Playbook training?', 45, ARRAY['brain'], ARRAY['all'], true),
  ('/training/agency', 'Want to access your agency''s custom training?', 'How do I find agency training?', 45, ARRAY['brain'], ARRAY['all'], true),
  
  -- ==========================================
  -- STAFF PORTAL ADDITIONS (9 pages)
  -- ==========================================
  
  ('/staff/submit', 'Need help submitting your daily scorecard?', 'How do I submit my daily scorecard?', 30, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/metrics', 'Looking at your performance metrics?', 'How do I read my metrics?', 45, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/sales', 'Tracking your sales performance?', 'How does the sales dashboard work?', 45, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/team-rings', 'Want to see how your team is performing?', 'How does Team Rings work?', 45, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/lqs-roadmap', 'Need help with the sales roadmap?', 'How does the LQS Roadmap work?', 45, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/meeting-frame', 'Preparing for a meeting?', 'How do I use the Meeting Frame?', 30, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/life-targets', 'Ready to set your personal goals?', 'How do Life Targets work?', 45, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/training/standard', 'Looking for specific training?', 'How do I find training content?', 45, ARRAY['staff'], ARRAY['all'], true),
  ('/staff/training/agency', 'Want to view your agency''s custom training?', 'How do I access agency training?', 45, ARRAY['staff'], ARRAY['all'], true);
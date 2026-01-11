-- ============================================
-- MISSING FEATURE FAQs - Core 4, Flows, Life Targets, etc.
-- ============================================

INSERT INTO chatbot_faqs (question, answer, keywords, category, applies_to_portals, applies_to_roles, applies_to_tiers, page_context, priority, is_active) VALUES

-- ============ CORE 4 ============
(
  'What is Core 4?',
  'Core 4 is a daily habit tracking system that helps you build consistency in four key areas: Mind, Body, Balance, and Connection. Complete your Core 4 habits each day to build streaks and improve your overall score. Access it from the Personal Growth section in your sidebar.',
  ARRAY['core4', 'core 4', 'habits', 'daily', 'tracking', 'mind', 'body', 'balance', 'connection'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/core4', '/core4', '/dashboard'],
  9,
  true
),
(
  'How do I complete my Core 4?',
  'Click on Core 4 in your sidebar (under Personal Growth). You''ll see four domains: Mind, Body, Balance, and Connection. Click each one to mark it complete for the day. Try to complete all four daily to build your streak!',
  ARRAY['core4', 'complete', 'habits', 'daily', 'check', 'mark'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/core4', '/core4'],
  9,
  true
),
(
  'What are Core 4 streaks?',
  'Streaks track how many consecutive days you''ve completed all four Core 4 habits. Building streaks helps reinforce positive daily routines. Your current streak is shown on the Core 4 dashboard along with your weekly and monthly progress.',
  ARRAY['core4', 'streak', 'consecutive', 'days', 'progress'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/core4', '/core4'],
  7,
  true
),

-- ============ FLOWS ============
(
  'What are Flows?',
  'Flows are guided personal development journeys in Agency Brain. Each Flow takes you through a series of reflective questions designed to help you grow professionally and personally. Access Flows from the Personal Growth section in your sidebar.',
  ARRAY['flows', 'flow', 'personal', 'development', 'growth', 'journey', 'questions'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/flows', '/flows'],
  8,
  true
),
(
  'How do I start a Flow?',
  'Navigate to Personal Growth → Flows in your sidebar. Browse available Flow templates and click one to begin. Each Flow guides you through questions at your own pace. Your progress is saved automatically.',
  ARRAY['flows', 'start', 'begin', 'create'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/flows', '/flows'],
  8,
  true
),
(
  'What is a Flow Profile?',
  'Your Flow Profile summarizes insights from your completed Flows. It captures your reflections, goals, and personal development journey over time. Think of it as a living document of your growth.',
  ARRAY['flow', 'profile', 'summary', 'insights'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/flows', '/flows'],
  6,
  true
),

-- ============ LIFE TARGETS / QUARTERLY TARGETS ============
(
  'What are Life Targets?',
  'Life Targets (also called Quarterly Targets) help you set and track personal and professional goals on a 90-day cycle. Define what you want to achieve, break it into milestones, and track progress. Access from Personal Growth in your sidebar.',
  ARRAY['life', 'targets', 'quarterly', 'goals', '90', 'day', 'milestones'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/life-targets', '/life-targets'],
  7,
  true
),
(
  'How do I set quarterly targets?',
  'Go to Personal Growth → Life Targets. Click to add a new target, describe your goal, and set milestones. Review and update your progress throughout the quarter to stay on track.',
  ARRAY['quarterly', 'targets', 'set', 'create', 'goals'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/life-targets', '/life-targets'],
  7,
  true
),

-- ============ THETA TALK TRACK / 90-DAY AUDIO ============
(
  'What is the Theta Talk Track?',
  'The Theta Talk Track is a personalized 90-day audio affirmation program available to 1:1 Coaching members. It uses AI-generated voice to deliver daily affirmations customized to your goals. Access it from Personal Growth → 90-Day Audio.',
  ARRAY['theta', 'talk', 'track', 'audio', 'affirmations', '90', 'day'],
  'general',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['1:1 Coaching'],
  ARRAY['/theta-talk-track', '/staff/theta-talk-track'],
  7,
  true
),
(
  'Why can''t I access the Theta Talk Track?',
  'The Theta Talk Track is an exclusive feature for 1:1 Coaching members. If you''re on the Boardroom plan, you won''t have access to this feature. Contact info@standardplaybook.com to learn about upgrading.',
  ARRAY['theta', 'talk', 'track', 'access', 'cant', 'see'],
  'troubleshooting',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['Boardroom'],
  ARRAY['/theta-talk-track'],
  8,
  true
),

-- ============ MONTHLY MISSIONS ============
(
  'What are Monthly Missions?',
  'Monthly Missions are AI-generated action items designed to push your growth each month. They''re personalized based on your Flow Profile and goals. Check your Core 4 dashboard to see your current Monthly Mission.',
  ARRAY['monthly', 'missions', 'action', 'items', 'goals'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/core4', '/core4'],
  6,
  true
),

-- ============ LQS ROADMAP ============
(
  'What is the LQS Roadmap?',
  'The LQS (Lead-to-Quote-to-Sale) Roadmap helps you track prospects through your sales pipeline. It visualizes where each lead is in the journey from initial contact to closed sale. Access it from Sales → LQS Roadmap.',
  ARRAY['lqs', 'roadmap', 'lead', 'quote', 'sale', 'pipeline', 'prospects'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/lqs-roadmap', '/lqs-roadmap'],
  7,
  true
),
(
  'How do I use the LQS Roadmap?',
  'Navigate to Sales → LQS Roadmap. Add prospects and move them through stages: Lead → Quoted → Sold or Lost. This helps you visualize your pipeline and identify where deals are stalling.',
  ARRAY['lqs', 'use', 'prospects', 'stages', 'pipeline'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/lqs-roadmap', '/lqs-roadmap'],
  7,
  true
),

-- ============ TEAM RINGS ============
(
  'What are Team Rings?',
  'Team Rings provide a visual representation of team performance using circular progress indicators. Each ring shows how close a team member is to hitting their KPI targets. Great for quick team performance snapshots.',
  ARRAY['team', 'rings', 'performance', 'visual', 'kpi', 'progress'],
  'metrics',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/team-rings'],
  6,
  true
),

-- ============ RENEWALS / SERVICE ============
(
  'Where do I manage renewals?',
  'Access renewal management from Service → Renewals in your sidebar. Here you can track upcoming policy renewals, audit your book of business, and ensure retention efforts are on track.',
  ARRAY['renewals', 'retention', 'service', 'policies', 'book'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/renewals', '/renewals'],
  7,
  true
),
(
  'What is the Cancel Audit?',
  'The Cancel Audit tool helps you track and analyze policy cancellations. Review why policies were cancelled, identify patterns, and develop strategies to improve retention. Access from Service → Cancel Audit.',
  ARRAY['cancel', 'audit', 'cancellations', 'retention', 'policies'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/cancel-audit', '/cancel-audit'],
  6,
  true
),

-- ============ ROLEPLAY BOT - TIER RESTRICTION CLARITY ============
(
  'Why can''t I use the AI Sales Bot?',
  'The AI Sales Bot (Roleplay Bot) is exclusively available to 1:1 Coaching members. Boardroom members do not have access to this feature. If you''d like to practice sales conversations with AI, contact info@standardplaybook.com to learn about upgrading your membership.',
  ARRAY['ai', 'sales', 'bot', 'roleplay', 'cant', 'access', 'use'],
  'troubleshooting',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['Boardroom'],
  ARRAY['/roleplaybot', '/dashboard'],
  10,
  true
),
(
  'Who has access to the Roleplay Bot?',
  'The Roleplay Bot (AI Sales Bot) is available only to 1:1 Coaching members. It allows you to practice sales conversations with an AI prospect and receive grading on your performance. Boardroom members do not have access to this feature.',
  ARRAY['roleplay', 'bot', 'access', 'who', 'available', '1:1'],
  'roleplay',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/roleplaybot'],
  9,
  true
),

-- ============ FOCUS TARGETS ============
(
  'What are Focus Targets?',
  'Focus Targets are priority goals assigned by your coach (for owners) or your manager (for staff). They appear on your dashboard as key areas to concentrate on. Check your Focus card regularly to stay aligned with priorities.',
  ARRAY['focus', 'targets', 'goals', 'priorities', 'assigned'],
  'dashboard',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/dashboard', '/staff/dashboard'],
  8,
  true
),

-- ============ STAFF PORTAL - WHAT'S NOT AVAILABLE ============
(
  'What features are NOT available in the Staff Portal?',
  'As a staff member, you don''t have access to: Bonus Grid, Snapshot Planner, full Agency Management, team-wide Analytics, The Exchange community, or certain 1:1 Coaching features like the Roleplay Bot. These are reserved for agency owners and key employees.',
  ARRAY['staff', 'not', 'available', 'access', 'cant', 'restricted'],
  'staff-portal',
  ARRAY['staff'],
  ARRAY['manager', 'staff'],
  ARRAY['all'],
  ARRAY['/staff/dashboard'],
  9,
  true
);
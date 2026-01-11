-- ============================================
-- ADMIN & OWNER CAPABILITY FAQs
-- ============================================

INSERT INTO chatbot_faqs (question, answer, keywords, category, applies_to_portals, applies_to_roles, applies_to_tiers, page_context, priority, is_active) VALUES

-- ============ ADMIN VISIBILITY ============
(
  'What can I see as an admin?',
  'As an admin, you have access to the full Admin Panel at /admin. You can see all clients, their submission status, manage membership tiers, view system-wide analytics, manage training content, configure call scoring templates, and access all platform settings.',
  ARRAY['admin', 'see', 'access', 'visibility', 'can'],
  'general',
  ARRAY['brain'],
  ARRAY['admin'],
  ARRAY['all'],
  ARRAY['/admin', '/dashboard'],
  9,
  true
),
(
  'Can admins see individual staff data?',
  'Admins can view agency-level data and client dashboards, but individual staff metrics are primarily visible to the agency owner. For detailed staff performance, check with the specific agency owner or view data through the agency''s metrics and call scoring sections.',
  ARRAY['admin', 'staff', 'data', 'see', 'individual'],
  'general',
  ARRAY['brain'],
  ARRAY['admin'],
  ARRAY['all'],
  ARRAY['/admin'],
  7,
  true
),

-- ============ OWNER VISIBILITY - STAFF DATA ============
(
  'What staff data can I see as an agency owner?',
  'As an agency owner, you can see: staff scorecard submissions (Metrics → Submissions), call scoring results and analytics, training progress and completion status, and daily/weekly performance in Team Rings. Access these through your sidebar navigation.',
  ARRAY['owner', 'staff', 'data', 'see', 'view', 'visibility'],
  'agency',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/metrics', '/call-scoring', '/team-rings', '/agency'],
  9,
  true
),
(
  'Can I see my staff''s Core 4 progress?',
  'Currently, Core 4 completion is personal to each team member and visible on their own Staff Portal dashboard. As an owner, you don''t have a consolidated view of all staff Core 4 data. You can encourage staff to share their progress in team meetings.',
  ARRAY['staff', 'core4', 'core 4', 'see', 'view', 'progress'],
  'agency',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/agency', '/dashboard'],
  8,
  true
),
(
  'Can I see my staff''s Monthly Missions?',
  'Monthly Missions are personal to each team member and appear on their individual Core 4 dashboard in the Staff Portal. There isn''t currently a consolidated view for owners to see all staff Monthly Missions. Consider asking staff to share their missions during team meetings.',
  ARRAY['staff', 'monthly', 'missions', 'see', 'view'],
  'agency',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/agency', '/dashboard'],
  8,
  true
),
(
  'Can I see my staff''s Flow progress?',
  'Flow progress is personal to each team member. As an owner, you don''t have direct visibility into individual staff Flow completions. Flows are designed for personal reflection and growth. You can encourage staff to discuss insights from their Flows if appropriate.',
  ARRAY['staff', 'flow', 'flows', 'see', 'view', 'progress'],
  'agency',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/agency', '/flows'],
  7,
  true
),
(
  'Where do I see staff training progress?',
  'View staff training progress at Agency → Training Management, or navigate to /training/agency/manage. The Progress tab shows each staff member''s completion status across assigned modules and lessons.',
  ARRAY['staff', 'training', 'progress', 'see', 'view', 'completion'],
  'training',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/training', '/agency'],
  9,
  true
),
(
  'Where do I see staff scorecard submissions?',
  'View all staff scorecard submissions at Metrics → Submissions tab. You can filter by date, staff member, and form type. Click any submission to see the full details of what they reported.',
  ARRAY['staff', 'scorecard', 'submissions', 'see', 'view'],
  'metrics',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/metrics'],
  9,
  true
),
(
  'Where do I see staff call scores?',
  'View staff call scoring results at Call Scoring → Analytics tab. You can see individual call scores, trends over time, and compare performance across team members. Each staff member can also see their own scores in the Staff Portal.',
  ARRAY['staff', 'call', 'scores', 'scoring', 'see', 'view', 'results'],
  'call-scoring',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/call-scoring'],
  9,
  true
),

-- ============ FEATURE AVAILABILITY CLARIFICATIONS ============
(
  'What features are personal vs. shared?',
  'Personal (only you see your own): Core 4 progress, Flows, Monthly Missions, Life Targets. Shared/Visible to owners: Scorecard submissions, Call scoring results, Training progress. This separation keeps personal development private while business metrics are transparent.',
  ARRAY['personal', 'shared', 'private', 'visible', 'features'],
  'general',
  ARRAY['both'],
  ARRAY['owner', 'key_employee', 'manager', 'staff'],
  ARRAY['all'],
  ARRAY['/dashboard'],
  8,
  true
),
(
  'Why can''t I see certain staff data?',
  'Some features like Core 4, Flows, and Monthly Missions are designed as personal development tools, so staff data stays private to them. Business metrics like scorecards, call scores, and training progress ARE visible to owners. This balances accountability with personal growth space.',
  ARRAY['cant', 'see', 'staff', 'data', 'why', 'private'],
  'troubleshooting',
  ARRAY['brain'],
  ARRAY['owner', 'key_employee'],
  ARRAY['all'],
  ARRAY['/dashboard', '/agency'],
  8,
  true
);
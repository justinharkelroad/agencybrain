INSERT INTO public.chatbot_page_contexts (page_route, page_title, content, related_faq_categories, applies_to_portals, applies_to_tiers)
VALUES
-- TRAINING
('/training', 'Training Hub', '{
  "overview": "Central access for all training: Standard Playbook (pre-built curriculum) and Agency Training (custom content from your agency).",
  "ui_elements": [
    {"name": "Standard Playbook Section", "location": "main tab", "description": "Pre-built curriculum with categories, modules, lessons, videos, and quizzes."},
    {"name": "Agency Training Section", "location": "tab or section", "description": "Custom training created by your agency owner with assigned modules."},
    {"name": "Progress Indicators", "location": "on modules and lessons", "description": "Shows completion status, quiz scores, and overall progress."},
    {"name": "Categories", "location": "navigation", "description": "Training organized by topic (Sales, Service, Onboarding, etc.)."}
  ],
  "actions": [
    {"action": "Browse training content", "how": "Navigate through categories and modules to find lessons."},
    {"action": "Complete a lesson", "how": "Watch video content, review materials, complete the quiz."},
    {"action": "Track your progress", "how": "Check completion badges and progress indicators."}
  ],
  "common_questions": [
    {"question": "What is the difference between Standard Playbook and Agency Training?", "answer": "Standard Playbook is pre-built for all users. Agency Training is custom content your agency owner created for your team."},
    {"question": "How do I complete training?", "answer": "Open a lesson, watch the video, complete any quiz. Progress saves automatically."}
  ],
  "not_about": ["Call Scoring feedback - that is at /call-scoring", "Roleplay practice - that is at /roleplaybot", "Personal Flows - those are at /flows"],
  "related_pages": [{"route": "/roleplaybot", "reason": "Practice what you learn"}, {"route": "/call-scoring", "reason": "Get feedback on real calls"}]
}'::jsonb, ARRAY['training'], ARRAY['both'], ARRAY['all']),

-- SUBMIT FORM
('/submit', 'Submit Reporting Period', '{
  "overview": "Primary data entry form for submitting your agency performance metrics for a reporting period.",
  "ui_elements": [
    {"name": "Sales Section", "location": "form section", "description": "Enter premium sold, items sold, policies sold, VC achievement."},
    {"name": "Marketing Section", "location": "form section", "description": "Enter marketing spend, policies quoted, lead source performance."},
    {"name": "Operations Section", "location": "form section", "description": "Enter ALR total, AAP projection, bonus trend, roster info."},
    {"name": "Retention Section", "location": "form section", "description": "Enter terminated policies and retention percentage."},
    {"name": "Cash Flow Section", "location": "form section", "description": "Enter compensation and expenses. Net profit calculates automatically."},
    {"name": "Qualitative Section", "location": "form section (1:1 only)", "description": "Enter biggest stress, wins, attack items. Only for 1:1 Coaching members."},
    {"name": "Auto-Save Indicator", "location": "top or bottom", "description": "Shows save status. Data auto-backs up every 30 seconds."}
  ],
  "actions": [
    {"action": "Fill out the form", "how": "Complete each section with your data. Required fields are marked."},
    {"action": "Save progress", "how": "Data auto-saves every 30 seconds. You can also manually save."},
    {"action": "Submit the period", "how": "When complete, review and click Submit. Cannot edit after submission."}
  ],
  "common_questions": [
    {"question": "What goes in each section?", "answer": "Sales: premium and policies. Marketing: spend and leads. Operations: ALR, projections. Retention: terminations. Cash Flow: compensation and expenses."},
    {"question": "Does my data auto-save?", "answer": "Yes! Auto-backup every 30 seconds. Watch the save indicator for status."},
    {"question": "What is the qualitative section?", "answer": "Captures non-numeric data like stress, wins, action items. Only available to 1:1 Coaching members."}
  ],
  "not_about": ["Daily scorecards - staff submit those in Staff Portal", "Call uploads - those go to /call-scoring", "Training completion - that is at /training"],
  "related_pages": [{"route": "/dashboard", "reason": "Dashboard updates with submitted data"}, {"route": "/metrics", "reason": "View analytics of submissions"}]
}'::jsonb, ARRAY['submit'], ARRAY['brain'], ARRAY['all']),

-- METRICS
('/metrics', 'Metrics Dashboard', '{
  "overview": "Comprehensive KPI tracking, visualization, and management. View trends, manage scorecard forms, configure targets.",
  "ui_elements": [
    {"name": "Metrics Tab", "location": "tab navigation", "description": "Performance analytics with charts and trend data."},
    {"name": "Forms Tab", "location": "tab navigation", "description": "Create and manage scorecard forms. Generate public links for staff."},
    {"name": "Submissions Tab", "location": "tab navigation", "description": "View all scorecard submissions with filtering and search."},
    {"name": "Explorer Tab", "location": "tab navigation", "description": "Data exploration tools for custom queries."},
    {"name": "Targets Tab", "location": "tab navigation", "description": "Configure KPI targets and goals."}
  ],
  "actions": [
    {"action": "View performance metrics", "how": "Use Metrics tab for charts and visualizations."},
    {"action": "Create a scorecard form", "how": "Go to Forms tab, click create, configure fields, generate public link."},
    {"action": "Review staff submissions", "how": "Go to Submissions tab. Filter by date, staff, or form type."},
    {"action": "Set KPI targets", "how": "Go to Targets tab to configure goals for each metric."}
  ],
  "common_questions": [
    {"question": "How do I create a scorecard form?", "answer": "Go to Forms tab, create new, configure fields, save. Generate a public link to share with staff."},
    {"question": "Where do I see staff submissions?", "answer": "Submissions tab. Filter by date range, staff member, or form type."},
    {"question": "How do I set targets?", "answer": "Go to Targets tab to configure KPI goals for each metric you track."}
  ],
  "not_about": ["Call Scoring results - those are at /call-scoring", "Training progress - that is at /training", "Core 4 habits - those are at /core4"],
  "related_pages": [{"route": "/team-rings", "reason": "Visual team KPI rings"}, {"route": "/submit", "reason": "Submit your own data"}]
}'::jsonb, ARRAY['metrics', 'agency'], ARRAY['brain'], ARRAY['all']),

-- AGENCY
('/agency', 'Agency Management', '{
  "overview": "Comprehensive agency configuration hub for managing team, settings, lead sources, and more.",
  "ui_elements": [
    {"name": "Info Tab", "location": "tab navigation", "description": "Agency settings: name, email, phone, logo, permissions."},
    {"name": "Team Tab", "location": "tab navigation", "description": "Manage team members, create staff logins, configure Key Employees."},
    {"name": "Lead Sources Tab", "location": "tab navigation", "description": "Configure lead source types for marketing ROI tracking."},
    {"name": "Policy Types Tab", "location": "tab navigation", "description": "Define policy types for categorization and reporting."},
    {"name": "Checklists Tab", "location": "tab navigation", "description": "Agency-specific checklist templates."},
    {"name": "Uploads Tab", "location": "tab navigation", "description": "File management for shared documents."}
  ],
  "actions": [
    {"action": "Add a team member", "how": "Go to Team tab, click Add Member, enter details (name, email, role), save."},
    {"action": "Create staff login", "how": "In Team tab, find the member and create Staff Portal login. Choose email invite or manual creation."},
    {"action": "Add a Key Employee", "how": "Key Employees get owner-level access. Add them in Team tab under Key Employees."},
    {"action": "Manage lead sources", "how": "Go to Lead Sources tab to add, edit, or deactivate lead source types."}
  ],
  "common_questions": [
    {"question": "How do I add a team member?", "answer": "Go to Agency then Team tab. Click Add Member, fill name, email, role (Sales, Service, Hybrid, Manager), save."},
    {"question": "How do I create staff logins?", "answer": "In Team tab, find the member and create Staff Portal credentials. Email invite or manually create username/password."},
    {"question": "What are Key Employees?", "answer": "Team members with owner-level dashboard access. They see the same data you do but through the Brain Portal."}
  ],
  "not_about": ["Personal settings - those are at /settings", "Training content - that is at /training", "Call Scoring config - that is at /call-scoring"],
  "related_pages": [{"route": "/team-rings", "reason": "See team performance rings"}, {"route": "/metrics", "reason": "View team submissions"}]
}'::jsonb, ARRAY['agency'], ARRAY['brain'], ARRAY['all']),

-- ROLEPLAY BOT
('/roleplaybot', 'AI Roleplay Bot', '{
  "overview": "AI-powered sales practice tool. Have live voice conversations with an AI prospect, then receive graded feedback.",
  "ui_elements": [
    {"name": "Start Session Button", "location": "main area", "description": "Click to begin a new roleplay session with the AI prospect."},
    {"name": "Session History", "location": "list or sidebar", "description": "Your past roleplay sessions with dates and scores."},
    {"name": "Overall Grade", "location": "session results", "description": "Your overall performance score for a completed session."},
    {"name": "Category Scores", "location": "session results", "description": "Scores for: Information Verification, Rapport, Coverage Conversation, Wrap Up, Lever Pulls."},
    {"name": "Transcript", "location": "session results", "description": "Full transcript of your roleplay conversation."},
    {"name": "Share Link Generator", "location": "settings or session", "description": "Create secure links so staff can practice roleplay too."}
  ],
  "actions": [
    {"action": "Start a roleplay session", "how": "Click Start to begin. Have a voice conversation with AI prospect. End to receive grading."},
    {"action": "Review past sessions", "how": "Click any session in history to see transcript, scores, and feedback."},
    {"action": "Share with staff", "how": "Generate a share link that lets staff access roleplay practice."}
  ],
  "common_questions": [
    {"question": "What do the grades mean?", "answer": "Grades assess sales skills: Information Verification, Rapport, Coverage, Wrap Up, and Lever Pulls."},
    {"question": "How do I improve my score?", "answer": "Review feedback for each category. Practice the specific skills mentioned."},
    {"question": "Can my staff use this?", "answer": "Yes! Generate a share link and send to staff. They can practice using that link."}
  ],
  "not_about": ["Call Scoring of real calls - that is at /call-scoring", "Training videos - those are at /training", "Flows (personal reflection) - those are at /flows"],
  "related_pages": [{"route": "/call-scoring", "reason": "Score real calls after practicing"}, {"route": "/training", "reason": "Learn techniques for roleplay"}]
}'::jsonb, ARRAY['roleplay'], ARRAY['brain'], ARRAY['1:1 Coaching']);
-- Clear existing seed data and insert comprehensive FAQ knowledge base
DELETE FROM chatbot_faqs;

INSERT INTO chatbot_faqs (question, answer, keywords, category, applies_to_portals, applies_to_roles, applies_to_tiers, page_context, priority, is_active) VALUES

-- ===================== DASHBOARD (10 FAQs) =====================
('What is the Dashboard?', 'The Dashboard is your agency command center showing key performance metrics at a glance. It displays Premium, Policies, Marketing spend, Compensation, and Net Profit data from your submitted reporting periods.', ARRAY['dashboard', 'home', 'overview', 'metrics', 'performance'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 10, true),

('How do I read the Performance Metrics Card?', 'The Performance Metrics Card shows your key numbers: Written Premium, Issued Items/Policies, Marketing Spend, Quoted Households, VC percentage, Compensation, Expenses, and Net Profit. Gray text shows prior period for comparison.', ARRAY['metrics', 'card', 'premium', 'policies', 'performance'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 9, true),

('What are My Current Focus targets?', 'My Current Focus shows your daily and monthly targets for key metrics like Quoted Households and Sold Items. These targets are set in Metrics → Targets and help you track daily progress toward goals.', ARRAY['focus', 'targets', 'goals', 'daily', 'monthly'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 8, true),

('How do Month-Over-Month Trends work?', 'The Trends section shows how your metrics have changed compared to the same period last month. Green indicates improvement, red indicates decline. Click on any metric for more detail.', ARRAY['trends', 'month', 'comparison', 'growth', 'change'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 7, true),

('What is the Reporting Periods list?', 'The Reporting Periods list shows all your submitted data periods. You can click any period to view details or continue editing a draft. Periods can be monthly or custom date ranges.', ARRAY['periods', 'reports', 'history', 'submissions'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 7, true),

('Why do I see "No data available" on my Dashboard?', 'This appears when you haven''t submitted any reporting periods yet. Click "Submit" in the sidebar to enter your first reporting period data. Once submitted, your Dashboard will populate with metrics.', ARRAY['no data', 'empty', 'blank', 'missing'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 9, true),

('What are Shared Insights on the Dashboard?', 'Shared Insights are AI-generated analysis summaries that your coach has shared with you. They appear on your Dashboard when available and provide actionable recommendations based on your data.', ARRAY['insights', 'shared', 'ai', 'analysis', 'recommendations'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/dashboard'], 6, true),

('Can my Key Employees see the Dashboard?', 'Yes! Key Employees have access to the same Dashboard view as agency owners. They can see all performance metrics, trends, and reporting periods. You can manage Key Employees in Agency → Team.', ARRAY['key employee', 'access', 'permissions', 'share'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 7, true),

('How often should I check my Dashboard?', 'We recommend checking your Dashboard weekly to monitor trends. Submit your reporting period data at least monthly to keep metrics current and meaningful for tracking progress.', ARRAY['frequency', 'update', 'when', 'often'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 5, true),

('What is the Roleplay Sessions Card?', 'The Roleplay Sessions Card shows your recent AI roleplay practice sessions and scores. Click it to access the AI Sales Bot for more practice. This feature helps sharpen your sales conversations.', ARRAY['roleplay', 'sessions', 'card', 'practice', 'sales'], 'dashboard', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/dashboard'], 6, true),

-- ===================== SUBMIT (10 FAQs) =====================
('How do I submit my reporting period?', 'Click "Submit" in your sidebar to open the reporting form. Fill out each section (Sales, Marketing, Operations, Retention, Cash Flow) and your data auto-saves every 30 seconds. When complete, click Submit!', ARRAY['submit', 'reporting', 'period', 'data', 'form', 'save'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit', '/dashboard'], 10, true),

('Does my data save automatically?', 'Yes! Agency Brain auto-saves your submission every 30 seconds. You''ll see a "Saving..." indicator when it''s backing up. You can safely close and return later - your progress won''t be lost.', ARRAY['autosave', 'backup', 'automatic', 'save', 'progress'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 10, true),

('What is the Sales section for?', 'The Sales section captures your production data: Written Premium, Issued Items, Issued Policies, and VC (Variable Compensation) percentage. Enter these from your Allstate reports.', ARRAY['sales', 'production', 'premium', 'items', 'policies', 'vc'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 8, true),

('What goes in the Marketing section?', 'The Marketing section tracks your lead generation: Marketing Spend, Quoted Households, Lead Source breakdown, and Commission Rates. This helps calculate ROI on your marketing investments.', ARRAY['marketing', 'spend', 'leads', 'quoted', 'households', 'roi'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 8, true),

('What is the Operations section?', 'Operations captures agency health metrics: ALR (Agency Loss Ratio), AAP Projection, Bonus Trend indicators, and current roster count. These affect your Allstate bonus calculations.', ARRAY['operations', 'alr', 'aap', 'bonus', 'roster', 'agency'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 7, true),

('What goes in Retention?', 'The Retention section tracks policy churn: Terminated Items count and your Retention Percentage. Strong retention is key to agency profitability and bonus eligibility.', ARRAY['retention', 'terminated', 'churn', 'policies', 'cancel'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 7, true),

('What is Cash Flow?', 'Cash Flow tracks your agency finances: Total Compensation received, Operating Expenses, and calculated Net Profit. This gives you a clear picture of agency profitability.', ARRAY['cash flow', 'compensation', 'expenses', 'profit', 'money', 'income'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 8, true),

('What is the Qualitative section?', 'The Qualitative section is for 1:1 Coaching members only. It captures your current stress level, recent wins, and items to attack. Your coach uses this for personalized guidance.', ARRAY['qualitative', 'stress', 'wins', 'attack', 'coaching'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/submit'], 6, true),

('What happens if I submit twice on the same day?', 'Each submission creates a new reporting period. If you submit twice with overlapping dates, you''ll see a conflict warning. You can edit existing periods instead of creating duplicates.', ARRAY['duplicate', 'twice', 'conflict', 'overlap', 'edit'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/submit'], 7, true),

('Why can''t I see the Qualitative section?', 'The Qualitative section (Stress, Wins, Attack Items) is exclusive to 1:1 Coaching members. Boardroom members see the core financial sections. Contact info@standardplaybook.com to upgrade.', ARRAY['qualitative', 'missing', 'hidden', 'upgrade', 'tier'], 'submit', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['Boardroom'], ARRAY['/submit'], 8, true),

-- ===================== METRICS (10 FAQs) =====================
('What is the Metrics page?', 'Metrics is your KPI tracking hub with four tabs: Metrics (visualizations), Forms (create scorecards), Submissions (view all entries), and Explorer (search data). It''s where you manage team performance tracking.', ARRAY['metrics', 'kpi', 'forms', 'submissions', 'explorer'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 9, true),

('How do I create a scorecard form?', 'Go to Metrics → Forms tab → click "Create Form". Name your form, add KPI fields (numbers, text, checkboxes), and save. You can then share the public link with your team for daily submissions.', ARRAY['scorecard', 'form', 'create', 'builder', 'kpi'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics', '/metrics/builder'], 9, true),

('How do I share a scorecard form with my team?', 'In Metrics → Forms, click the three-dot menu on any form and select "Copy Link". Share this public URL with your team - they can submit without logging in. Or create Staff Portal logins for tracked submissions.', ARRAY['share', 'link', 'public', 'team', 'url'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 9, true),

('What is the Submissions tab?', 'The Submissions tab shows all scorecard entries from your team. You can filter by date, team member, or form. Click any row to see full submission details and leave feedback.', ARRAY['submissions', 'entries', 'view', 'filter', 'history'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 8, true),

('What is the Explorer tab?', 'Explorer is a powerful data search tool. You can query prospect data, filter by date ranges, and export results. It helps you analyze lead flow and production patterns across your team.', ARRAY['explorer', 'search', 'query', 'data', 'filter', 'export'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 7, true),

('How do I set KPI targets?', 'Go to Metrics → Targets tab to configure daily and monthly goals. Set targets for Quoted Households, Sold Items, and other KPIs. These targets appear in your Dashboard''s "My Current Focus" section.', ARRAY['targets', 'goals', 'kpi', 'daily', 'monthly', 'set'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 8, true),

('Can staff see each other''s submissions?', 'By default, staff can only see their own submissions. Managers can see their team''s submissions. Only owners and key employees have full visibility. This protects individual performance data.', ARRAY['visibility', 'privacy', 'see', 'others', 'permissions'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/metrics'], 7, true),

('How do I edit a scorecard form?', 'Go to Metrics → Forms, click the three-dot menu on the form you want to edit, and select "Edit Form". You can add/remove fields, change labels, and update settings. Changes apply to future submissions.', ARRAY['edit', 'modify', 'update', 'form', 'fields'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 8, true),

('What is a form field mapping?', 'Field mappings connect your scorecard fields to standardized KPI categories. This allows automatic rollup of metrics across different forms and consistent reporting in your Dashboard.', ARRAY['mapping', 'fields', 'kpi', 'standardized', 'rollup'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics/builder'], 6, true),

('How do I delete a scorecard submission?', 'As an owner, go to Metrics → Submissions, find the entry, click the three-dot menu, and select Delete. Note: Deleted submissions cannot be recovered. Staff cannot delete their own submissions.', ARRAY['delete', 'remove', 'submission', 'entry'], 'metrics', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/metrics'], 6, true),

-- ===================== AGENCY (10 FAQs) =====================
('Where can I manage my team members?', 'Go to Agency in your sidebar, then click the Team tab. From there you can add team members, set their roles (Sales, Service, Hybrid, Manager), create Staff Portal logins, and designate Key Employees.', ARRAY['team', 'members', 'staff', 'add', 'manage', 'agency'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 10, true),

('How do I add a new team member?', 'Go to Agency → Team → click "Add Member". Enter their name, email, role (Sales, Service, Hybrid, or Manager), and optionally create Staff Portal login credentials. They''ll appear in your roster immediately.', ARRAY['add', 'new', 'team', 'member', 'hire', 'create'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 9, true),

('What is a Key Employee?', 'Key Employees are trusted team members who get full Dashboard access like an owner. They can view all metrics, submit periods, and manage agency settings. Invite them from Agency → Team.', ARRAY['key employee', 'access', 'dashboard', 'permissions', 'invite'], 'agency', ARRAY['brain'], ARRAY['owner'], ARRAY['all'], ARRAY['/agency'], 8, true),

('How do I create Staff Portal logins?', 'In Agency → Team, click on a team member, then "Create Staff Login". Set a username and password. Staff use these credentials at /staff/login to access their limited portal.', ARRAY['staff', 'login', 'portal', 'credentials', 'password', 'access'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 9, true),

('What are Lead Sources?', 'Lead Sources track where your prospects come from. Go to Agency → Lead Sources to add sources like "Data", "Live Transfers", "Walk-ins", etc. These are used in your Submit form for marketing attribution.', ARRAY['lead sources', 'marketing', 'data', 'transfers', 'attribution'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 7, true),

('What are Policy Types?', 'Policy Types define your product categories (Auto, Home, Life, etc.). Configure them in Agency → Policy Types. They''re used throughout the platform for production tracking and reporting.', ARRAY['policy types', 'products', 'auto', 'home', 'life', 'categories'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 6, true),

('What is the Checklists feature?', 'Checklists help onboard new hires with required tasks. Go to Agency → Checklists to create templates. Assign them to team members to track completion of training, paperwork, and certifications.', ARRAY['checklists', 'onboarding', 'tasks', 'new hire', 'training'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 6, true),

('What is the Meeting Frame?', 'Meeting Frame is a structured agenda builder for team meetings. Go to Agency → Meeting Frame to create templates with discussion topics, metrics review, and action items.', ARRAY['meeting', 'frame', 'agenda', 'team', 'structure'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 5, true),

('How do I update my agency logo?', 'Go to Agency → Info tab. Click on the logo placeholder or current logo to upload a new image. Your logo appears on scorecards, reports, and the Staff Portal. Recommended size: 200x200px.', ARRAY['logo', 'upload', 'image', 'branding', 'update'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 6, true),

('What agency settings can I configure?', 'In Agency → Info, you can set your agency name, contact info, timezone, and feature toggles like "Staff Can Upload Calls" and "Contest Board Enabled". These affect platform behavior for your whole team.', ARRAY['settings', 'configure', 'options', 'toggle', 'preferences'], 'agency', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency'], 7, true),

-- ===================== TRAINING (10 FAQs) =====================
('What training resources are available?', 'Agency Brain offers two training tracks: Standard Playbook (pre-built curriculum with videos and quizzes) and Agency Training (custom content your owner creates). Access both from Training in your sidebar.', ARRAY['training', 'learn', 'courses', 'playbook', 'videos', 'resources'], 'training', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/training', '/staff/training'], 10, true),

('What is the Standard Playbook?', 'Standard Playbook is our curated training curriculum with categories like Sales, Service, and Leadership. Each category has modules with video lessons and quizzes. Track your progress as you complete lessons.', ARRAY['playbook', 'standard', 'curriculum', 'videos', 'lessons'], 'training', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/training/standard'], 9, true),

('What is Agency Training?', 'Agency Training is custom content created by your agency owner. It can include videos, documents, and assignments specific to your agency''s processes. Look for the "Agency" tab in Training.', ARRAY['agency training', 'custom', 'owner', 'content', 'assignments'], 'training', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/training/agency'], 8, true),

('How do I create custom training content?', 'As an owner, go to Training → Agency Training → Manage. Click "Add Content" to create lessons with videos, PDFs, or text. You can assign content to specific team members or make it available to all.', ARRAY['create', 'custom', 'content', 'add', 'manage', 'lessons'], 'training', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/training/agency/manage'], 8, true),

('How do I assign training to staff?', 'When creating or editing Agency Training content, you can assign it to specific team members. They''ll see assigned content highlighted in their Training portal. Track completion from the admin view.', ARRAY['assign', 'staff', 'team', 'content', 'required'], 'training', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/training/agency/manage'], 7, true),

('How do I track training progress?', 'Owners can see team training progress in Training → Agency Training → Manage. It shows who has started, completed, or not begun each piece of content. Staff see their own progress on lesson pages.', ARRAY['progress', 'track', 'completion', 'status', 'started'], 'training', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/training'], 7, true),

('What happens when I complete a lesson?', 'When you finish watching a video or reading content and pass any quiz, the lesson is marked complete. A checkmark appears and your progress percentage updates. Completed lessons stay accessible for review.', ARRAY['complete', 'finish', 'done', 'checkmark', 'progress'], 'training', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/training'], 6, true),

('How do quizzes work?', 'Some lessons have quizzes at the end. Answer the questions and submit. You need a passing score to complete the lesson. If you don''t pass, you can review the content and try again.', ARRAY['quiz', 'questions', 'test', 'pass', 'fail', 'answers'], 'training', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/training'], 7, true),

('Can staff access training from the Staff Portal?', 'Yes! Staff with portal logins can access their assigned training from Staff Portal → Training. They see both Standard Playbook and any Agency Training assigned to them.', ARRAY['staff', 'portal', 'access', 'login', 'training'], 'training', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/training'], 8, true),

('Why can''t I see certain training categories?', 'Some training categories may be restricted by role or tier. If you don''t see expected content, check with your agency owner about your access level. 1:1 Coaching members have access to premium content.', ARRAY['missing', 'categories', 'access', 'restricted', 'hidden'], 'training', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/training'], 5, true),

-- ===================== BONUS GRID (8 FAQs) =====================
('What is the Bonus Grid?', 'The Bonus Grid is an Allstate bonus calculator for 1:1 Coaching members. It helps you model different production scenarios and see how they affect your bonus tier (38%-44%). Access it from the sidebar.', ARRAY['bonus', 'grid', 'allstate', 'calculator', 'tier'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid'], 10, true),

('Why can''t I see the Bonus Grid?', 'The Bonus Grid is exclusive to 1:1 Coaching members. Boardroom members don''t have access to this feature. Contact info@standardplaybook.com to learn about upgrading your membership.', ARRAY['missing', 'access', 'hidden', 'boardroom', 'upgrade'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['Boardroom'], ARRAY['/bonus-grid', '/dashboard'], 9, true),

('How do I use the Baseline Table?', 'The Baseline Table captures your starting metrics: current PIF, retention rate, and production baselines. Enter your data here first - it''s the foundation for all bonus calculations.', ARRAY['baseline', 'table', 'pif', 'retention', 'inputs'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid'], 8, true),

('What is the New Business Table?', 'The New Business Table models your planned production. Enter projected items per month, average premium, and mix by policy type. The grid calculates how this affects your bonus tier.', ARRAY['new business', 'production', 'items', 'premium', 'model'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid'], 8, true),

('What are PPI values?', 'PPI (Premium Per Item) values are your average premium by policy type. The Bonus Grid uses these to convert item counts into premium projections. Keep them updated for accurate calculations.', ARRAY['ppi', 'premium', 'per item', 'average', 'values'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid'], 7, true),

('How do bonus tiers work?', 'Allstate bonus tiers range from 38% to 44% based on your Gross Profit percentage. The Bonus Grid shows which tier you''re tracking toward based on your inputs. Higher tiers mean larger bonus payouts.', ARRAY['tiers', '38', '44', 'gross profit', 'percentage', 'levels'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid'], 7, true),

('Does the Bonus Grid save automatically?', 'Yes! Like all Agency Brain forms, the Bonus Grid auto-saves your inputs. You''ll see a save indicator. Your data persists between sessions so you can refine projections over time.', ARRAY['save', 'auto', 'persist', 'data', 'automatic'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid'], 6, true),

('How does the Bonus Grid connect to Snapshot Planner?', 'The Snapshot Planner uses Bonus Grid data to project your Rest-of-Year trajectory. Make sure your Bonus Grid is up-to-date for accurate Snapshot projections.', ARRAY['snapshot', 'planner', 'connect', 'integration', 'roy'], 'bonus-grid', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/bonus-grid', '/snapshot-planner'], 6, true),

-- ===================== SNAPSHOT PLANNER (5 FAQs) =====================
('What is the Snapshot Planner?', 'Snapshot Planner is a trajectory analysis tool that projects your Rest-of-Year (ROY) performance. It uses your Bonus Grid data to show monthly and daily targets needed to hit your bonus tier goals.', ARRAY['snapshot', 'planner', 'roy', 'trajectory', 'projection'], 'snapshot-planner', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/snapshot-planner'], 8, true),

('How do I access the Snapshot Planner?', 'Click Snapshot Planner in your sidebar (requires 1:1 Coaching). You''ll need to have your Bonus Grid filled out first, as Snapshot uses that data for calculations.', ARRAY['access', 'find', 'location', 'sidebar'], 'snapshot-planner', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/snapshot-planner'], 7, true),

('What are ROY calculations?', 'ROY (Rest of Year) calculations show what you need to achieve in remaining months to hit your annual goals. Snapshot breaks this into monthly targets and even daily production numbers.', ARRAY['roy', 'rest of year', 'annual', 'goals', 'targets'], 'snapshot-planner', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/snapshot-planner'], 7, true),

('Why is my Snapshot showing no data?', 'Snapshot Planner requires Bonus Grid data to generate projections. Make sure you''ve filled out your Bonus Grid with baseline and production inputs first, then return to Snapshot.', ARRAY['empty', 'no data', 'blank', 'missing'], 'snapshot-planner', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/snapshot-planner'], 6, true),

('Can I export my Snapshot projections?', 'Currently, Snapshot Planner is view-only within the platform. You can screenshot the projections or manually note your targets. PDF export may be added in a future update.', ARRAY['export', 'download', 'pdf', 'print', 'save'], 'snapshot-planner', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/snapshot-planner'], 4, true),

-- ===================== ROLEPLAY (8 FAQs) =====================
('What is the AI Roleplay Bot?', 'The AI Roleplay Bot simulates customer conversations so you can practice sales scenarios. It grades your performance across categories like Rapport, Coverage Discussion, and Closing. Available to 1:1 Coaching members.', ARRAY['roleplay', 'ai', 'bot', 'practice', 'sales', 'simulation'], 'roleplay', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['1:1 Coaching'], ARRAY['/roleplaybot'], 9, true),

('How do I start a roleplay session?', 'Click "AI Sales Bot" in your sidebar. Choose a scenario type, then speak or type your responses. The AI plays the customer role and responds realistically. When done, you''ll receive a graded scorecard.', ARRAY['start', 'begin', 'session', 'scenario', 'how to'], 'roleplay', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['1:1 Coaching'], ARRAY['/roleplaybot'], 9, true),

('What categories does roleplay grade?', 'Roleplay grades five areas: Information Verification, Rapport Building, Coverage Discussion, Wrap Up, and Lever Pulls (objection handling). Each gets a score with specific feedback.', ARRAY['grades', 'categories', 'scoring', 'feedback', 'areas'], 'roleplay', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['1:1 Coaching'], ARRAY['/roleplaybot'], 7, true),

('How do I share roleplay with my staff?', 'After a session, click "Share" to generate a link. Staff can access roleplay through that link even without full platform access. Great for training exercises and team practice.', ARRAY['share', 'link', 'staff', 'team', 'access'], 'roleplay', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['1:1 Coaching'], ARRAY['/roleplaybot'], 7, true),

('Can I download my roleplay results?', 'Yes! After completing a session, click the PDF export button to download a formatted scorecard. It includes your scores, transcript, and improvement suggestions.', ARRAY['download', 'pdf', 'export', 'results', 'save'], 'roleplay', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['1:1 Coaching'], ARRAY['/roleplaybot'], 6, true),

('Why can''t I access the Roleplay Bot?', 'The AI Roleplay Bot is exclusive to 1:1 Coaching members. If you''re a Boardroom member, this feature isn''t included in your tier. Contact info@standardplaybook.com to upgrade.', ARRAY['access', 'cant', 'missing', 'boardroom', 'upgrade'], 'roleplay', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['Boardroom'], ARRAY['/roleplaybot'], 8, true),

('How accurate is the AI roleplay grading?', 'The AI uses advanced language models to evaluate your responses based on insurance industry best practices. While not perfect, it provides consistent, objective feedback for improvement areas.', ARRAY['accurate', 'grading', 'ai', 'quality', 'reliable'], 'roleplay', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['1:1 Coaching'], ARRAY['/roleplaybot'], 5, true),

('What is 90 Day Audio?', '90 Day Audio (Theta Talk Track) is supplemental audio training content for 1:1 Coaching members. It provides sales strategies and scripts in audio format for on-the-go learning.', ARRAY['90 day', 'audio', 'theta', 'talk track', 'listening'], 'roleplay', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['1:1 Coaching'], ARRAY['/theta-talk-track'], 5, true),

-- ===================== CALL SCORING (10 FAQs) =====================
('What is Call Scoring?', 'Call Scoring uses AI to analyze recorded phone calls and provide detailed feedback. Upload a call recording and receive scores across multiple skill categories, plus coaching recommendations.', ARRAY['call scoring', 'ai', 'analysis', 'recording', 'feedback'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring', '/staff/call-scoring'], 10, true),

('How do I upload a call for scoring?', 'Go to Call Scoring, click "Upload Call", select your audio file (MP3, WAV, M4A, OGG - max 100MB, 75 min), choose the team member and template, then click Upload. Analysis takes 2-5 minutes.', ARRAY['upload', 'file', 'audio', 'recording', 'how to'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring', '/staff/call-scoring'], 10, true),

('What file formats are supported for call uploads?', 'Call Scoring accepts MP3, WAV, M4A, and OGG audio files. Maximum file size is 100MB. Maximum call duration is 75 minutes. Files are automatically converted for analysis.', ARRAY['format', 'mp3', 'wav', 'm4a', 'file type', 'audio'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring'], 8, true),

('What are Call Scoring templates?', 'Templates define the scoring criteria for different call types (New Business, Service, Claims, etc.). Each template has specific skill categories and weights. Your agency may have custom templates.', ARRAY['template', 'criteria', 'types', 'categories', 'scoring'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/call-scoring'], 7, true),

('How do I interpret my call score?', 'Call scores range from 0-100. Each skill category (like Rapport, Discovery, Closing) gets an individual score. The overall score is a weighted average. Higher scores indicate better technique alignment.', ARRAY['score', 'interpret', 'understand', 'meaning', 'results'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring'], 8, true),

('What is call acknowledgment?', 'After reviewing a scored call, staff should acknowledge they''ve seen the feedback. Managers can track acknowledgments to ensure coaching is being received and reviewed.', ARRAY['acknowledge', 'review', 'seen', 'feedback', 'confirmation'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring'], 6, true),

('Are there monthly limits on call scoring?', 'Yes, each agency has a monthly call scoring allocation based on their plan. You can view remaining calls in Call Scoring. Limits reset on your billing cycle date. Contact support to increase limits.', ARRAY['limits', 'monthly', 'quota', 'allocation', 'remaining'], 'call-scoring', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/call-scoring'], 7, true),

('How do I give staff access to call scoring?', 'In Agency → Info, enable "Staff Can Upload Calls". Staff with portal logins can then access Call Scoring from their Staff Portal. They''ll only see their own calls unless they''re a manager.', ARRAY['staff', 'access', 'enable', 'permissions', 'upload'], 'call-scoring', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/call-scoring', '/agency'], 8, true),

('Can I see call transcripts?', 'Yes! Each scored call includes a full transcript. You can view the conversation, see speaker labels (Agent vs Customer), and jump to specific moments referenced in the scoring feedback.', ARRAY['transcript', 'text', 'conversation', 'view', 'read'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring'], 7, true),

('What are coaching recommendations?', 'After scoring, the AI provides specific coaching recommendations based on areas where the call could improve. These are actionable tips for the agent to practice and develop.', ARRAY['coaching', 'recommendations', 'tips', 'improve', 'suggestions'], 'call-scoring', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring'], 7, true),

-- ===================== EXCHANGE (7 FAQs) =====================
('What is The Exchange?', 'The Exchange is a community platform where Agency Brain members share insights, resources, and experiences. Post questions, share wins, and connect with other insurance professionals.', ARRAY['exchange', 'community', 'share', 'post', 'connect'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange'], 8, true),

('How do I create a post on The Exchange?', 'From The Exchange, click "Create Post". Add your content (text, links, files), select relevant tags, and choose visibility (All Members or your Agency only). Click Post to share.', ARRAY['post', 'create', 'share', 'write', 'new'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange'], 8, true),

('What are Exchange tags?', 'Tags categorize posts by topic (e.g., Marketing, Hiring, Operations). Use relevant tags when posting so others can find your content. You can filter the feed by tags to find specific topics.', ARRAY['tags', 'categories', 'filter', 'topics', 'labels'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange'], 6, true),

('Can I message other members directly?', 'Yes! Click on any member''s profile to start a direct conversation. The Exchange Messages feature lets you have private discussions separate from public posts.', ARRAY['message', 'dm', 'direct', 'private', 'chat'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange/messages'], 6, true),

('How do I like or comment on posts?', 'Click the heart icon to like a post. Click the comment icon to add your thoughts. Engaging with content helps surface the best insights for the community.', ARRAY['like', 'comment', 'engage', 'react', 'reply'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange'], 5, true),

('Who can see my Exchange posts?', 'Posts set to "All Members" are visible to everyone in the Agency Brain community. Posts set to your "Agency Only" are private to your team. Admins can moderate all content.', ARRAY['visibility', 'privacy', 'who can see', 'public', 'private'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange'], 6, true),

('Why can''t staff access The Exchange?', 'The Exchange is currently available to Owners, Key Employees, and Managers. Staff members focus on their scorecards and training. This may change in future updates.', ARRAY['staff', 'access', 'restricted', 'why', 'cant'], 'exchange', ARRAY['brain'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/exchange'], 5, true),

-- ===================== STAFF PORTAL (10 FAQs) =====================
('What is the Staff Portal?', 'The Staff Portal is a simplified interface for team members. Staff log in with credentials created by their owner and can submit scorecards, view their metrics, and access assigned training.', ARRAY['staff portal', 'login', 'team', 'access', 'interface'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/login', '/staff/dashboard'], 10, true),

('How do I log into the Staff Portal?', 'Go to your agency''s Staff Portal login page (usually yoursite.com/staff/login). Enter the username and password your agency owner created for you. Contact your owner if you forgot credentials.', ARRAY['login', 'sign in', 'credentials', 'password', 'access'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/login'], 10, true),

('How do I submit my daily scorecard?', 'From your Staff Dashboard, find your scorecard form or use the quick-submit link your owner provided. Fill in your daily numbers (calls, quotes, sales) and submit. Do this before end of day!', ARRAY['scorecard', 'daily', 'submit', 'numbers', 'form'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/dashboard'], 10, true),

('What can I see on my Staff Dashboard?', 'Your Staff Dashboard shows your submitted scorecards, personal metrics, focus targets, and any announcements. Managers also see their team''s submissions and can access additional reports.', ARRAY['dashboard', 'see', 'view', 'features', 'what'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/dashboard'], 9, true),

('Can I see other staff members'' scores?', 'As a regular staff member, you only see your own submissions. Managers can see their team''s submissions. This protects individual performance data while enabling team oversight.', ARRAY['others', 'see', 'scores', 'team', 'visibility'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/dashboard'], 7, true),

('Why can''t I see the Bonus Grid from Staff Portal?', 'The Bonus Grid, Snapshot Planner, and full analytics are owner-level features not available in the Staff Portal. If you need this data, ask your agency owner for access as a Key Employee.', ARRAY['bonus grid', 'cant see', 'access', 'owner', 'restricted'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/dashboard'], 7, true),

('How do I change my Staff Portal password?', 'Contact your agency owner to reset your Staff Portal password. Owners manage staff credentials from Agency → Team. For security, staff cannot self-reset passwords.', ARRAY['password', 'change', 'reset', 'forgot', 'credentials'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/login'], 8, true),

('What is the Core 4 tracker?', 'Core 4 is a daily wellness tracker covering Body, Being, Balance, and Business. Check off each domain as you complete your daily practice. It helps build consistent success habits.', ARRAY['core 4', 'wellness', 'habits', 'daily', 'tracker', 'body', 'being', 'balance', 'business'], 'staff-portal', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/staff/dashboard', '/dashboard'], 6, true),

('Can managers edit staff submissions?', 'Managers can view staff submissions but cannot edit them. Only agency owners have the ability to modify or delete submissions. Managers can leave feedback and comments.', ARRAY['manager', 'edit', 'modify', 'submissions', 'permissions'], 'staff-portal', ARRAY['staff'], ARRAY['manager'], ARRAY['all'], ARRAY['/staff/dashboard'], 6, true),

('How do I access training from Staff Portal?', 'Click "Training" in your Staff Portal sidebar. You''ll see Standard Playbook content and any Agency Training your owner has assigned. Complete lessons to track your progress.', ARRAY['training', 'access', 'find', 'staff', 'portal'], 'staff-portal', ARRAY['staff'], ARRAY['manager', 'staff'], ARRAY['all'], ARRAY['/staff/training'], 8, true),

-- ===================== SETTINGS (6 FAQs) =====================
('How do I update my profile?', 'Click your avatar in the top-right corner and select "Settings" or "Profile". From there you can update your display name, email, and profile picture.', ARRAY['profile', 'update', 'name', 'email', 'picture'], 'settings', ARRAY['brain'], ARRAY['admin', 'owner', 'key_employee'], ARRAY['all'], ARRAY['/settings'], 8, true),

('How do I change my password?', 'Go to Settings → Security or Password section. Enter your current password, then your new password twice. Click Save. Use a strong password with letters, numbers, and symbols.', ARRAY['password', 'change', 'security', 'update', 'new'], 'settings', ARRAY['brain'], ARRAY['admin', 'owner', 'key_employee'], ARRAY['all'], ARRAY['/settings'], 9, true),

('How do I switch between light and dark mode?', 'Click the theme toggle (sun/moon icon) in the header or go to Settings → Appearance. Choose Light, Dark, or System (follows your device). Your preference is saved automatically.', ARRAY['dark mode', 'light mode', 'theme', 'appearance', 'toggle'], 'settings', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/settings', '/staff/settings'], 7, true),

('How do I manage notification preferences?', 'Go to Settings → Notifications. Toggle email notifications for different events (scorecard reminders, training assignments, etc.). Changes take effect immediately.', ARRAY['notifications', 'email', 'alerts', 'preferences', 'manage'], 'settings', ARRAY['brain'], ARRAY['admin', 'owner', 'key_employee'], ARRAY['all'], ARRAY['/settings'], 6, true),

('Can I change my email address?', 'Yes, go to Settings → Profile and update your email. You may need to verify the new email address. If you''re having trouble, contact support at info@standardplaybook.com.', ARRAY['email', 'change', 'update', 'address', 'account'], 'settings', ARRAY['brain'], ARRAY['admin', 'owner', 'key_employee'], ARRAY['all'], ARRAY['/settings'], 6, true),

('How do I log out?', 'Click your avatar in the top-right corner and select "Sign Out" or "Log Out". You''ll be returned to the login page. Make sure to log out when using shared devices.', ARRAY['logout', 'sign out', 'exit', 'leave', 'session'], 'settings', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard', '/staff/dashboard'], 7, true),

-- ===================== NAVIGATION (7 FAQs) =====================
('How do I navigate Agency Brain?', 'Use the sidebar on the left to access all features. Main sections include Dashboard, Submit, Metrics, Agency, Training, and more. Click any item to navigate. The sidebar collapses on mobile.', ARRAY['navigate', 'sidebar', 'menu', 'find', 'where'], 'navigation', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 9, true),

('Where do I find my dashboard?', 'Click "Dashboard" in the top of your sidebar, or it''s often the default page after login. The Dashboard shows your key metrics and performance overview.', ARRAY['dashboard', 'find', 'where', 'location', 'home'], 'navigation', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 8, true),

('How do I collapse the sidebar?', 'Click the arrow icon at the bottom of the sidebar to collapse it. Click again to expand. On mobile, the sidebar becomes a hamburger menu you can tap to open/close.', ARRAY['sidebar', 'collapse', 'minimize', 'hide', 'mobile'], 'navigation', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 5, true),

('What are the folder icons in the sidebar?', 'Folder icons indicate sections with sub-items. Click the folder to expand and see nested features (like Agency Mgmt tools or Training options). Click again to collapse.', ARRAY['folder', 'expand', 'submenu', 'nested', 'section'], 'navigation', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 5, true),

('Why do some sidebar items have locks?', 'Lock icons indicate features restricted to your tier. 1:1 Coaching features show locks for Boardroom members. Upgrade your membership to unlock these features.', ARRAY['lock', 'locked', 'restricted', 'tier', 'upgrade'], 'navigation', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['Boardroom'], ARRAY['/dashboard'], 7, true),

('How do I switch between portals?', 'If you have access to both Brain Portal and Staff Portal, use separate URLs or logins. Brain Portal is for owners at your main login. Staff Portal is at /staff/login for team credentials.', ARRAY['switch', 'portal', 'brain', 'staff', 'both'], 'navigation', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager'], ARRAY['all'], ARRAY['/dashboard', '/staff/dashboard'], 6, true),

('What is the quick actions menu?', 'Some pages have a quick actions button (often a + or ... icon) that provides shortcuts to common tasks like adding team members, creating forms, or starting submissions.', ARRAY['quick actions', 'shortcuts', 'menu', 'plus', 'button'], 'navigation', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard', '/agency'], 4, true),

-- ===================== TROUBLESHOOTING (10 FAQs) =====================
('Why is my data not saving?', 'Check your internet connection first. Agency Brain auto-saves every 30 seconds - look for the "Saving..." indicator. If problems persist, try refreshing the page. Your data backs up automatically.', ARRAY['not saving', 'lost', 'data', 'problem', 'error'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/submit', '/metrics'], 10, true),

('Why can''t I log in?', 'Double-check your email and password. Use "Forgot Password" if needed. If you''re staff, make sure you''re at the Staff Portal login (/staff/login) with staff credentials, not the main login.', ARRAY['login', 'cant', 'access', 'password', 'error'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/auth', '/staff/login'], 10, true),

('Why do I see "Access Denied"?', 'Access Denied appears when trying to reach features outside your role or tier. Staff can''t access owner features. Boardroom can''t access 1:1 Coaching features. Contact your owner or upgrade.', ARRAY['access denied', 'forbidden', 'cant access', 'permission', 'error'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 9, true),

('Why is the page loading slowly?', 'Slow loading can be caused by internet speed, large data sets, or high traffic times. Try refreshing, clearing your browser cache, or using a different browser. Contact support if it persists.', ARRAY['slow', 'loading', 'performance', 'speed', 'lag'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 7, true),

('Why did I get logged out unexpectedly?', 'Sessions expire after a period of inactivity for security. If you''re logged out frequently, check if you''re sharing the account (not allowed) or if cookies are being blocked by your browser.', ARRAY['logged out', 'session', 'expired', 'unexpected', 'kicked'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/auth', '/staff/login'], 7, true),

('Why are my charts or graphs not showing?', 'Charts require data to display. Make sure you''ve submitted reporting periods with the relevant metrics. Also try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to reload chart components.', ARRAY['charts', 'graphs', 'not showing', 'blank', 'missing'], 'troubleshooting', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard', '/metrics'], 6, true),

('How do I report a bug?', 'Email info@standardplaybook.com with details about the issue: what you were doing, what happened, any error messages, and screenshots if possible. We''ll investigate and respond promptly.', ARRAY['bug', 'report', 'issue', 'problem', 'error', 'help'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 8, true),

('Why is my call upload failing?', 'Check that your file is MP3, WAV, M4A, or OGG format, under 100MB, and under 75 minutes. Ensure you have remaining call scoring quota. Try a different browser if the problem persists.', ARRAY['upload', 'failing', 'call', 'error', 'file'], 'troubleshooting', ARRAY['both'], ARRAY['owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/call-scoring'], 8, true),

('Why can''t my staff see their scorecard?', 'Make sure staff have active portal logins (Agency → Team). Verify the scorecard form is active and shared. Check that staff are using the correct login credentials at /staff/login.', ARRAY['staff', 'scorecard', 'cant see', 'access', 'form'], 'troubleshooting', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/agency', '/metrics'], 8, true),

('The mobile view looks broken. What should I do?', 'Try rotating your device or using landscape mode for complex pages. Clear your browser cache and refresh. Some features work better on tablet or desktop. Report persistent issues to support.', ARRAY['mobile', 'broken', 'display', 'layout', 'phone'], 'troubleshooting', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 6, true),

-- ===================== GENERAL (8 FAQs) =====================
('What is Agency Brain?', 'Agency Brain is a comprehensive management platform for insurance agencies. It helps you track production, manage team performance, access training, analyze calls, and optimize your business operations.', ARRAY['what is', 'about', 'overview', 'platform', 'agency brain'], 'general', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 10, true),

('How do I get started with Agency Brain?', 'Start by exploring your Dashboard, then submit your first reporting period. Set up your team in Agency → Team. Configure scorecard forms in Metrics. Check out Training for educational content.', ARRAY['getting started', 'begin', 'first steps', 'new', 'onboarding'], 'general', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 10, true),

('What membership tiers are available?', 'Agency Brain offers three tiers: 1:1 Coaching (full features including Bonus Grid, Roleplay, and qualitative coaching), Boardroom (core features), and Call Scoring (focused on call analysis).', ARRAY['tiers', 'membership', 'plans', 'pricing', 'levels'], 'general', ARRAY['brain'], ARRAY['admin', 'owner', 'key_employee'], ARRAY['all'], ARRAY['/dashboard'], 8, true),

('How do I contact support?', 'Email info@standardplaybook.com for any questions, issues, or feedback. Include your agency name and a description of your question. We typically respond within 24 business hours.', ARRAY['support', 'contact', 'help', 'email', 'question'], 'general', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 10, true),

('Is my data secure?', 'Yes! Agency Brain uses enterprise-grade security with encrypted data storage, secure authentication, and regular backups. Your data is private to your agency and never shared with other users.', ARRAY['security', 'data', 'safe', 'privacy', 'encrypted'], 'general', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 7, true),

('Can I use Agency Brain on mobile?', 'Yes! Agency Brain is fully responsive and works on phones and tablets. Some complex features like form builders work best on larger screens, but daily tasks are mobile-friendly.', ARRAY['mobile', 'phone', 'tablet', 'app', 'responsive'], 'general', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 7, true),

('What browsers are supported?', 'Agency Brain works best on modern browsers: Chrome, Firefox, Safari, and Edge. Make sure you''re using an updated version. Internet Explorer is not supported.', ARRAY['browser', 'chrome', 'firefox', 'safari', 'edge', 'supported'], 'general', ARRAY['both'], ARRAY['admin', 'owner', 'key_employee', 'manager', 'staff'], ARRAY['all'], ARRAY['/dashboard'], 5, true),

('How do I upgrade my membership?', 'Contact info@standardplaybook.com to discuss upgrading from Boardroom to 1:1 Coaching. We''ll explain the additional features and help you transition smoothly.', ARRAY['upgrade', 'membership', 'tier', 'coaching', 'change'], 'general', ARRAY['brain'], ARRAY['owner', 'key_employee'], ARRAY['Boardroom'], ARRAY['/dashboard'], 8, true);
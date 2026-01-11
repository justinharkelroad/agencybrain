-- ============================================
-- PAGE CONTEXT DOCUMENTS TABLE
-- ============================================
CREATE TABLE public.chatbot_page_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_route TEXT NOT NULL UNIQUE,
  page_title TEXT NOT NULL,
  content JSONB NOT NULL,
  related_faq_categories TEXT[] DEFAULT '{}',
  applies_to_portals TEXT[] DEFAULT '{both}',
  applies_to_tiers TEXT[] DEFAULT '{all}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_contexts_route ON public.chatbot_page_contexts (page_route);
CREATE INDEX idx_page_contexts_active ON public.chatbot_page_contexts (is_active);

ALTER TABLE public.chatbot_page_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active page contexts"
ON public.chatbot_page_contexts
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage page contexts"
ON public.chatbot_page_contexts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE TRIGGER update_chatbot_page_contexts_updated_at
  BEFORE UPDATE ON public.chatbot_page_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED CORE PAGE CONTEXTS (5 pages)
-- ============================================
INSERT INTO public.chatbot_page_contexts (page_route, page_title, content, related_faq_categories, applies_to_portals, applies_to_tiers)
VALUES
-- FLOWS
('/flows', 'Flows', '{
  "overview": "Flows are guided personal development journeys with reflective questions designed to help you grow professionally and personally.",
  "ui_elements": [
    {"name": "Flow Score", "location": "top right area", "description": "Shows your overall Flow engagement progress (0-100). This reflects how many Flows you have completed. It is NOT a grade - it measures participation."},
    {"name": "Streak Counter", "location": "near the score", "description": "Shows consecutive days you have engaged with Flows."},
    {"name": "Flow Library", "location": "main content area", "description": "Browse available Flow templates for guided reflection."},
    {"name": "My Flows", "location": "tab or section", "description": "Your in-progress and completed Flows."},
    {"name": "Flow Profile", "location": "accessible from this page", "description": "Summary of insights from your completed Flows."}
  ],
  "actions": [
    {"action": "Start a new Flow", "how": "Click on any Flow template in the library to begin."},
    {"action": "Continue an in-progress Flow", "how": "Go to My Flows and click on any in-progress Flow."},
    {"action": "View your Flow Profile", "how": "Access Flow Profile to see insights from all your Flows."}
  ],
  "common_questions": [
    {"question": "What does the score at the top mean?", "answer": "The score shows your Flow engagement progress. It reflects how many Flows you completed - it is not a grade, just participation tracking."},
    {"question": "How do I improve my Flow score?", "answer": "Complete more Flows! Each finished Flow contributes to your score."},
    {"question": "What is a Flow Profile?", "answer": "Your Flow Profile summarizes insights from completed Flows, showing growth patterns over time."}
  ],
  "not_about": ["Call Scoring - call scores are at /call-scoring", "Team metrics - those are at /metrics", "Roleplay grades - those are at /roleplaybot", "Daily habits - those are Core 4 at /core4"],
  "related_pages": [{"route": "/life-targets", "reason": "Set quarterly goals"}, {"route": "/core4", "reason": "Daily habit tracking"}]
}'::jsonb, ARRAY['general', 'navigation'], ARRAY['both'], ARRAY['all']),

-- CALL SCORING
('/call-scoring', 'Call Scoring', '{
  "overview": "Upload recorded calls for AI analysis. The AI evaluates your sales or service calls against best practices and provides detailed feedback.",
  "ui_elements": [
    {"name": "Overall Score", "location": "top of results", "description": "A weighted average score from 0-100 based on skill categories like Rapport, Discovery, Presentation, and Closing. Higher is better."},
    {"name": "Category Scores", "location": "below overall score", "description": "Individual scores for each skill category showing strengths and areas for improvement."},
    {"name": "Upload Area", "location": "main content", "description": "Drag and drop or click to upload call recordings. Supports MP3, WAV, M4A, OGG up to 100MB and 75 minutes."},
    {"name": "Transcript", "location": "after analysis", "description": "AI-generated transcript of your call with timestamps."},
    {"name": "Feedback Section", "location": "below scores", "description": "Detailed AI feedback on what you did well and suggestions for improvement."},
    {"name": "Usage Counter", "location": "header area", "description": "Shows calls used this month versus your plan limit."}
  ],
  "actions": [
    {"action": "Upload a call", "how": "Click upload area or drag and drop an audio file. Select a template if prompted."},
    {"action": "View past call scores", "how": "Your call history shows previous uploads. Click any to see full analysis."},
    {"action": "Acknowledge feedback", "how": "Click Acknowledge after reviewing to confirm you reviewed the results."}
  ],
  "common_questions": [
    {"question": "What does the score at the top mean?", "answer": "The overall call score (0-100) is a weighted average of your performance across skill categories like Rapport, Discovery, and Closing. Higher is better!"},
    {"question": "What file formats can I upload?", "answer": "MP3, WAV, M4A, or OGG audio files. Max 100MB and 75 minutes."},
    {"question": "How long does analysis take?", "answer": "Typically 1-3 minutes depending on call length."}
  ],
  "not_about": ["Flows or personal development - those are at /flows", "Roleplay practice - that is at /roleplaybot", "Team metrics - those are at /metrics"],
  "related_pages": [{"route": "/roleplaybot", "reason": "Practice sales calls with AI"}, {"route": "/training", "reason": "Training to improve skills"}]
}'::jsonb, ARRAY['call-scoring', 'troubleshooting'], ARRAY['both'], ARRAY['all']),

-- DASHBOARD
('/dashboard', 'Dashboard', '{
  "overview": "Your central hub showing key performance metrics, focus targets, recent activity, and quick access to important features.",
  "ui_elements": [
    {"name": "Performance Metrics Card", "location": "prominent position", "description": "Shows recent reporting period: Premium Sold, Policies Sold, Quoted, VC Achievement, Marketing Spend, Compensation, Expenses, Net Profit."},
    {"name": "My Current Focus", "location": "dashboard card", "description": "Active focus targets assigned by your coach - priority areas to concentrate on."},
    {"name": "Month-Over-Month Trends", "location": "dashboard card", "description": "Visual comparison of performance over recent months."},
    {"name": "Roleplay Sessions Card", "location": "dashboard card", "description": "Quick access to recent roleplay practice sessions and scores."},
    {"name": "Shared Insights", "location": "dashboard card", "description": "Insights and recommendations shared by your coach."},
    {"name": "Reporting Periods", "location": "dashboard section", "description": "List of all submitted reporting periods."}
  ],
  "actions": [
    {"action": "Submit a new reporting period", "how": "Click Submit in the sidebar to open the submission form."},
    {"action": "View detailed metrics", "how": "Click on any metric card or go to Metrics in the sidebar."},
    {"action": "Check focus targets", "how": "View the My Current Focus card for your priority areas."}
  ],
  "common_questions": [
    {"question": "What do the dashboard metrics mean?", "answer": "Shows your most recent reporting period. Premium Sold is total premium, Policies Sold is count, VC Achievement tracks Variable Compensation, Net Profit is Compensation minus Expenses."},
    {"question": "How do I update my dashboard data?", "answer": "Submit a new reporting period! Go to Submit in the sidebar, fill the form, and submit."},
    {"question": "What are focus targets?", "answer": "Priority goals set by your coach in the My Current Focus section."}
  ],
  "not_about": ["Call Scoring results - those are at /call-scoring", "Training content - that is at /training", "Team management - that is at /agency"],
  "related_pages": [{"route": "/submit", "reason": "Submit data to update dashboard"}, {"route": "/metrics", "reason": "Deeper analytics"}]
}'::jsonb, ARRAY['dashboard', 'general', 'submit'], ARRAY['brain'], ARRAY['all']),

-- CORE 4
('/core4', 'Core 4', '{
  "overview": "Daily habit tracking system for four key life domains: Mind, Body, Balance, and Connection. Build consistency by completing all four each day.",
  "ui_elements": [
    {"name": "Daily Score", "location": "top/prominent", "description": "Shows how many of the 4 habits you completed today (0-4). Complete all 4 to build your streak!"},
    {"name": "Weekly Progress", "location": "chart or grid", "description": "Visual showing Core 4 completion for each day of the week."},
    {"name": "Streak Counter", "location": "near score", "description": "Consecutive days with all 4 habits completed."},
    {"name": "Four Domain Cards", "location": "main content", "description": "Mind, Body, Balance, Connection. Click each to mark complete."},
    {"name": "Monthly Mission", "location": "card or section", "description": "AI-generated action item for the month based on your goals."}
  ],
  "actions": [
    {"action": "Complete a Core 4 habit", "how": "Click on any domain card (Mind, Body, Balance, Connection) to mark it complete."},
    {"action": "Build a streak", "how": "Complete all 4 habits every day to increase your streak counter."},
    {"action": "View Monthly Mission", "how": "Check the Monthly Mission card for your AI-generated monthly focus."}
  ],
  "common_questions": [
    {"question": "What does the score mean?", "answer": "The Core 4 score shows how many of the 4 daily habits you completed today (0-4). Complete all 4 for a perfect day!"},
    {"question": "What are the four domains?", "answer": "Mind (mental growth), Body (physical health), Balance (relationships/lifestyle), Connection (social/spiritual)."},
    {"question": "How do streaks work?", "answer": "Complete all 4 habits in a day to maintain your streak. Miss a day and it resets."}
  ],
  "not_about": ["Call Scoring - that is at /call-scoring", "Business metrics - those are at /dashboard and /metrics", "Flows (guided reflections) - those are at /flows"],
  "related_pages": [{"route": "/flows", "reason": "Deeper personal reflection"}, {"route": "/life-targets", "reason": "Set quarterly goals"}]
}'::jsonb, ARRAY['general'], ARRAY['both'], ARRAY['all']),

-- BONUS GRID
('/bonus-grid', 'Bonus Grid', '{
  "overview": "Allstate bonus calculator that helps you model production scenarios and see how they affect your bonus tier percentage (38%-44%).",
  "ui_elements": [
    {"name": "Baseline Table", "location": "top section", "description": "Enter starting metrics: current PIF, retention rate, production baselines. Foundation for all calculations."},
    {"name": "New Business Table", "location": "middle section", "description": "Enter projected new business to see how growth affects your bonus."},
    {"name": "Growth Bonus Factors", "location": "configuration area", "description": "Multipliers affecting bonus calculations based on Allstate guidelines."},
    {"name": "PPI Values", "location": "settings or table", "description": "Points Per Item values - how many points each policy type contributes."},
    {"name": "Tier Display", "location": "results area", "description": "Shows bonus percentage tiers (38%-44%) and dollar amounts for each."},
    {"name": "Daily/Monthly Targets", "location": "results area", "description": "Calculated targets showing items needed to hit each tier."}
  ],
  "actions": [
    {"action": "Enter baseline data", "how": "Fill the Baseline Table with current PIF, retention, and production numbers."},
    {"action": "Model scenarios", "how": "Adjust New Business numbers to see how production levels affect your tier."},
    {"action": "Save your grid", "how": "Data auto-saves as you work."}
  ],
  "common_questions": [
    {"question": "What are the bonus tiers?", "answer": "Allstate bonus tiers range from 38% to 44%. Higher production pushes you into higher tiers, meaning higher percentage bonus on eligible premium."},
    {"question": "What is PPI?", "answer": "Points Per Item - how many points each policy type contributes toward your bonus calculation."},
    {"question": "Why cant I see the Bonus Grid?", "answer": "Bonus Grid is exclusive to 1:1 Coaching members. Boardroom members do not have access."}
  ],
  "not_about": ["Call Scoring - that is at /call-scoring", "General performance metrics - those are at /dashboard", "Training - that is at /training"],
  "related_pages": [{"route": "/snapshot-planner", "reason": "Calculate Rest of Year targets"}, {"route": "/submit", "reason": "Submit data for calculations"}]
}'::jsonb, ARRAY['bonus-grid'], ARRAY['brain'], ARRAY['1:1 Coaching']);
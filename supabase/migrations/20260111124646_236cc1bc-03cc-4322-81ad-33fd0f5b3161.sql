INSERT INTO public.chatbot_page_contexts (page_route, page_title, content, related_faq_categories, applies_to_portals, applies_to_tiers)
VALUES
-- STAFF DASHBOARD
('/staff/dashboard', 'Staff Dashboard', '{
  "overview": "Your personal dashboard showing performance metrics, focus targets, and quick access to training and tools.",
  "ui_elements": [
    {"name": "Performance Summary", "location": "main area", "description": "Your recent scorecard submissions and key metrics."},
    {"name": "Focus Targets", "location": "card or section", "description": "Priority goals assigned by your manager or agency owner."},
    {"name": "Quick Actions", "location": "dashboard", "description": "Links to submit scorecard, access training, and common tasks."},
    {"name": "Core 4 Status", "location": "card", "description": "Your daily Core 4 habit completion status."}
  ],
  "actions": [
    {"action": "Submit daily scorecard", "how": "Click submit button or go to your scorecard form."},
    {"action": "View your training", "how": "Navigate to Training for assigned modules and Standard Playbook."},
    {"action": "Complete Core 4", "how": "Go to Core 4 to mark daily habits complete."}
  ],
  "common_questions": [
    {"question": "How do I submit my scorecard?", "answer": "Click the submit button on your dashboard or navigate to your scorecard form."},
    {"question": "What are focus targets?", "answer": "Priority goals set by your manager or agency owner. They help you focus on what matters most."},
    {"question": "Where is my training?", "answer": "Click Training in the sidebar to access Standard Playbook and Agency Training."}
  ],
  "not_about": ["Agency management - that is for owners only", "Bonus Grid - that is for owners only", "Full analytics - those are owner-level features"],
  "related_pages": [{"route": "/staff/training", "reason": "Access training content"}, {"route": "/staff/core4", "reason": "Complete Core 4 habits"}]
}'::jsonb, ARRAY['staff-portal', 'dashboard'], ARRAY['staff'], ARRAY['all']),

-- STAFF CORE 4
('/staff/core4', 'Staff Core 4', '{
  "overview": "Daily habit tracking for four key life domains: Mind, Body, Balance, and Connection.",
  "ui_elements": [
    {"name": "Daily Score", "location": "top/prominent", "description": "How many of the 4 habits you completed today (0-4)."},
    {"name": "Streak Counter", "location": "near score", "description": "Consecutive days with all 4 habits completed."},
    {"name": "Four Domain Cards", "location": "main content", "description": "Mind, Body, Balance, Connection. Click each to mark complete."},
    {"name": "Weekly View", "location": "section", "description": "Your completion pattern for the week."}
  ],
  "actions": [
    {"action": "Complete a habit", "how": "Click on any domain card to mark it complete for today."},
    {"action": "Build your streak", "how": "Complete all 4 habits every day to increase your streak."}
  ],
  "common_questions": [
    {"question": "What does the score mean?", "answer": "Shows how many Core 4 habits you completed today (0-4). Complete all 4 for a perfect day!"},
    {"question": "What are the four domains?", "answer": "Mind (mental growth), Body (physical health), Balance (lifestyle), Connection (relationships)."},
    {"question": "How do streaks work?", "answer": "Complete all 4 habits in a day to maintain your streak. Miss a day and it resets."}
  ],
  "not_about": ["Call Scoring - that is at /staff/call-scoring", "Training - that is at /staff/training", "Scorecard submission - that is on your dashboard"],
  "related_pages": [{"route": "/staff/flows", "reason": "Deeper personal reflection"}, {"route": "/staff/dashboard", "reason": "Back to dashboard"}]
}'::jsonb, ARRAY['general'], ARRAY['staff'], ARRAY['all']),

-- STAFF FLOWS
('/staff/flows', 'Staff Flows', '{
  "overview": "Guided personal development journeys with reflective questions to help you grow.",
  "ui_elements": [
    {"name": "Flow Score", "location": "top area", "description": "Your overall Flow engagement progress (0-100). Measures participation, not performance."},
    {"name": "Flow Library", "location": "main content", "description": "Available Flow templates to start."},
    {"name": "My Flows", "location": "section or tab", "description": "Your in-progress and completed Flows."}
  ],
  "actions": [
    {"action": "Start a Flow", "how": "Click on any Flow template to begin answering reflective questions."},
    {"action": "Continue a Flow", "how": "Go to My Flows to pick up where you left off."}
  ],
  "common_questions": [
    {"question": "What does the score at the top mean?", "answer": "The Flow score shows your engagement progress with personal development. It reflects how many Flows you completed - not a grade, just participation."},
    {"question": "What are Flows?", "answer": "Guided reflection exercises. You answer questions to help you think through goals, challenges, and growth."}
  ],
  "not_about": ["Call Scoring - that is at /staff/call-scoring", "Training content - that is at /staff/training", "Daily habits - those are Core 4 at /staff/core4"],
  "related_pages": [{"route": "/staff/core4", "reason": "Daily habit tracking"}, {"route": "/staff/life-targets", "reason": "Set quarterly goals"}]
}'::jsonb, ARRAY['general'], ARRAY['staff'], ARRAY['all']),

-- STAFF CALL SCORING
('/staff/call-scoring', 'Staff Call Scoring', '{
  "overview": "Upload your recorded calls for AI analysis and feedback on your conversation skills.",
  "ui_elements": [
    {"name": "Upload Area", "location": "main content", "description": "Drag and drop or click to upload call recordings."},
    {"name": "Overall Score", "location": "results area", "description": "Your call score from 0-100, a weighted average of skill categories."},
    {"name": "Category Scores", "location": "results area", "description": "Scores for Rapport, Discovery, Presentation, Closing, etc."},
    {"name": "Feedback", "location": "results area", "description": "Detailed AI feedback on what you did well and how to improve."},
    {"name": "My Calls", "location": "list or history", "description": "Your previously scored calls."}
  ],
  "actions": [
    {"action": "Upload a call", "how": "Click upload area or drag and drop an audio file (MP3, WAV, M4A, OGG)."},
    {"action": "View your scores", "how": "After upload completes, view overall score and category breakdown."},
    {"action": "Review past calls", "how": "Click any call in history for full analysis."}
  ],
  "common_questions": [
    {"question": "What does the score mean?", "answer": "The overall score (0-100) measures how well your call aligned with best practices across categories like Rapport, Discovery, Closing. Higher is better!"},
    {"question": "What file formats work?", "answer": "MP3, WAV, M4A, or OGG files. Max 100MB and 75 minutes."},
    {"question": "How do I improve my score?", "answer": "Review detailed feedback for each category. It tells you specifically what to work on."}
  ],
  "not_about": ["Flows (personal reflection) - those are at /staff/flows", "Training videos - those are at /staff/training", "Core 4 habits - those are at /staff/core4"],
  "related_pages": [{"route": "/staff/training", "reason": "Learn techniques to improve"}, {"route": "/staff/dashboard", "reason": "Back to dashboard"}]
}'::jsonb, ARRAY['call-scoring', 'staff-portal'], ARRAY['staff'], ARRAY['all']),

-- STAFF TRAINING
('/staff/training', 'Staff Training', '{
  "overview": "Access Standard Playbook curriculum and Agency Training content assigned by your agency owner.",
  "ui_elements": [
    {"name": "Standard Playbook", "location": "tab or section", "description": "Pre-built training curriculum available to all users."},
    {"name": "Agency Training", "location": "tab or section", "description": "Custom training from your agency, including assigned modules."},
    {"name": "Progress Indicators", "location": "on modules and lessons", "description": "Shows what you completed and what remains."},
    {"name": "Categories", "location": "navigation", "description": "Training organized by topic area."}
  ],
  "actions": [
    {"action": "Browse training", "how": "Navigate through categories and modules to find lessons."},
    {"action": "Complete a lesson", "how": "Watch the video, review materials, complete any quiz."},
    {"action": "Track progress", "how": "Check completion badges and progress indicators."}
  ],
  "common_questions": [
    {"question": "What is the difference between Standard Playbook and Agency Training?", "answer": "Standard Playbook is pre-built for everyone. Agency Training is custom content your agency owner created specifically for your team."},
    {"question": "How do I complete a lesson?", "answer": "Open the lesson, watch the video, complete any quiz. Progress saves automatically."},
    {"question": "How do I track my progress?", "answer": "Look for checkmarks, progress bars, and completion badges on modules and lessons."}
  ],
  "not_about": ["Call Scoring - that is at /staff/call-scoring", "Personal Flows - those are at /staff/flows", "Daily habits - those are at /staff/core4"],
  "related_pages": [{"route": "/staff/call-scoring", "reason": "Get call feedback"}, {"route": "/staff/dashboard", "reason": "Back to dashboard"}]
}'::jsonb, ARRAY['training', 'staff-portal'], ARRAY['staff'], ARRAY['all']);
-- ============================================
-- STAN KNOWLEDGE BASE TABLE
-- Single comprehensive document
-- ============================================

CREATE TABLE public.chatbot_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,  -- The full markdown knowledge document
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active version at a time
CREATE UNIQUE INDEX idx_knowledge_base_active ON public.chatbot_knowledge_base (is_active) WHERE is_active = true;

ALTER TABLE public.chatbot_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active knowledge base" ON public.chatbot_knowledge_base
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage knowledge base" ON public.chatbot_knowledge_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE TRIGGER update_chatbot_knowledge_base_updated_at
  BEFORE UPDATE ON public.chatbot_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the complete knowledge document
INSERT INTO public.chatbot_knowledge_base (version, content, is_active) VALUES (1, 
$STAN_KNOWLEDGE$
# Stan's Knowledge Base - Agency Brain

Stan is the AI assistant for Agency Brain, an insurance agency management platform. This document is Stan's complete knowledge of every feature, page, and metric in the application.

## IMPORTANT RULES FOR STAN

1. **Use this document as your PRIMARY source** - If the answer is here, use it.
2. **Match by route** - When user is on a specific page, find that section first.
3. **Never guess UI elements** - If a metric or button isn't documented here, say "I don't have specific information about that element. Can you describe what you're seeing?"
4. **Respect tier restrictions** - Boardroom users CANNOT access 1:1 Coaching features.
5. **Be concise** - 2-4 sentences unless more detail is genuinely needed.

## MEMBERSHIP TIERS

- **1:1 Coaching**: Full access to all features including Bonus Grid, Snapshot Planner, Roleplay Bot, Theta Talk Track, qualitative submissions
- **Boardroom**: Dashboard and metrics focus. NO access to: Bonus Grid, Snapshot Planner, Roleplay Bot, Theta Talk Track, qualitative sections
- **Call Scoring**: Add-on tier for call scoring features

---

# BRAIN PORTAL PAGES (Agency Owners)

---

## /dashboard - Main Dashboard

**Purpose**: Central hub showing key performance metrics, focus targets, and quick access to features.

**UI Elements**:
- **Performance Metrics Card**: Shows most recent reporting period - Premium Sold, Policies Sold, Policies Quoted, VC Achievement, Marketing Spend, Compensation, Expenses, Net Profit (green if positive, red if negative)
- **My Current Focus**: Active focus targets assigned by coach with progress indicators and due dates
- **Month-Over-Month Trends**: Historical performance comparison charts
- **Roleplay Sessions Card**: Recent AI roleplay practice sessions and scores
- **Shared Insights**: Coach-shared recommendations and feedback
- **Reporting Periods**: List of all submitted reporting periods with status

**Common Questions**:
- "What do the metrics mean?" → Shows your most recent reporting period data. Premium Sold is total premium dollars, Policies Sold is count of new policies, VC Achievement tracks Variable Compensation status, Net Profit = Compensation minus Expenses.
- "How do I update my dashboard?" → Submit a new reporting period via the Submit page. Your dashboard updates with the new data.
- "What are focus targets?" → Priority goals set by your coach to concentrate on specific improvement areas.

**This page is NOT about**: Call scores, training content, team management, file uploads.

---

## /cancel-audit - Cancel Audit

**Purpose**: Policy retention workflow tool for tracking and managing policies at risk of cancellation. Helps agencies proactively contact customers to prevent policy lapses.

**UI Elements**:
- **Working List** (hero stat): Count of active records that need attention (not yet resolved or lost)
- **At Risk** (hero stat): Total premium in dollars currently at risk of cancellation
- **Saved** (hero stat): Total premium in dollars successfully RETAINED by resolving at-risk policies. This is money that would have been lost but was saved through agency intervention. Example: "Saved $17,501" means $17,501 in premium was kept because the agency contacted customers and prevented cancellations.
- **Week-over-Week Trends**: Arrows showing change from prior week (e.g., "-100% vs last week")
- **Weekly Stats Summary**: Contacts made, payments collected, premium recovered this week
- **Activity Summary**: Breakdown of activity types (calls, emails, etc.)
- **Urgency Timeline**: Visual chart showing records grouped by days until cancel date
- **Filter Bar**: View mode toggle (Needs Attention vs All), report type filter, search, sort options
- **Record Cards**: Individual policy records showing insured name, policy details, status
- **Bulk Actions**: When records are selected, update status or delete multiple at once

**Status Types**:
- new: Just uploaded, no action taken yet
- in_progress: Being actively worked
- resolved: Policy SAVED! Premium was retained
- lost: Policy cancelled, premium lost

**Common Questions**:
- "What does Saved mean?" → The dollar amount of premium that was successfully retained. These are policies that were about to cancel, but through agency outreach (calls, emails, payment arrangements), the customer kept their policy. It's money saved from being lost.
- "What does At Risk mean?" → Total premium dollars in your working list that could be lost if those policies cancel.
- "How do I upload records?" → Click the Upload button in the header to import cancellation or pending cancel CSV reports.
- "What's the urgency timeline?" → Shows your at-risk policies grouped by how many days until they cancel, helping you prioritize the most urgent ones.

**This page is NOT about**: Renewals (that's /renewals), general metrics, call scoring, training.

---

## /renewals - Renewals Management

**Purpose**: Manage upcoming policy renewals with workflow tracking. Track which renewals have been contacted, outcomes, and maintain premium.

**UI Elements**:
- **Dashboard Charts**: Visual overview of renewals by effective date and day of week
- **Activity Summary**: Previous business day's activity breakdown
- **Status Tabs**: Filter by workflow status (uncontacted, pending, success, unsuccessful)
- **Priority Toggle**: Show only high-priority renewals marked with a star
- **Table View**: All renewal records with sortable columns
- **Premium Change %**: How much the renewal premium changed vs. prior term
- **Bundled vs Monoline**: Shows if policy is bundled with others

**Workflow Statuses**:
- uncontacted: Not yet reached out
- pending: Contact made, awaiting outcome
- success: Renewal confirmed
- unsuccessful: Customer did not renew

**Common Questions**:
- "How do I upload renewals?" → Click Upload to import renewal reports as CSV files.
- "What does premium change mean?" → The percentage difference between the renewal premium and what they paid last term.
- "How do I mark a renewal as priority?" → Click the star icon on any renewal record to mark it high-priority.

**This page is NOT about**: Cancellations (that's /cancel-audit), new business, call scoring.

---

## /submit - Submit Reporting Period

**Purpose**: Primary data entry form for submitting agency performance metrics for a reporting period.

**Sections**:
- **Sales Section**: Premium sold, items sold, policies sold, VC Achievement status
- **Marketing Section**: Total marketing spend, policies quoted, lead sources with individual spend tracking, sold premium per lead source, commission rates
- **Operations Section**: Current ALR total, AAP projection (Emerging/Solid/Premier), current bonus trend, team roster management
- **Retention Section**: Number terminated, current retention percentage
- **Cash Flow Section**: Compensation, expenses, net profit (auto-calculated)
- **Qualitative Section** (1:1 Coaching only): Biggest stress, gut action needed, biggest personal win, biggest business win, top 3 attack items

**UI Elements**:
- **Auto-Save Indicator**: Shows save status - data auto-backs up every 30 seconds
- **Period Selector**: Choose which reporting period you're submitting
- **Submit Button**: Lock in the submission (cannot edit after)

**Common Questions**:
- "Does my data auto-save?" → Yes! Data backs up every 30 seconds. Watch the save indicator for status.
- "Can I edit after submitting?" → No, once submitted, a reporting period is locked. Review carefully before submitting.
- "What's the qualitative section?" → Non-numeric data about your stress, wins, and action items. Only available to 1:1 Coaching members.

**This page is NOT about**: Daily scorecards (staff submit those), call uploads, training.

---

## /bonus-grid - Allstate Bonus Grid

**Access**: 1:1 Coaching members only. Boardroom members do NOT have access.

**Purpose**: Sophisticated calculator replicating the Allstate bonus structure spreadsheet. Model production scenarios and see how they affect your bonus tier percentage.

**UI Elements**:
- **Baseline Table**: Enter current PIF (policies in force), retention rate, production baselines
- **New Business Table**: Enter projected new business numbers
- **Growth Bonus Factors**: Multipliers affecting bonus calculations per Allstate guidelines
- **PPI Values** (Points Per Item): How many points each policy type contributes. Can use defaults or customize.
- **Tier Display**: Shows bonus percentage tiers (38%-44%) and dollar amounts for each
- **Daily/Monthly Targets**: Calculated targets showing items needed to hit each tier
- **Maximum Bonus Potential**: Your highest possible bonus based on inputs

**Common Questions**:
- "What are the bonus tiers?" → Allstate bonus tiers range from 38% to 44%. Higher production and better metrics push you into higher tiers, meaning a higher percentage bonus on eligible premium.
- "What is PPI?" → Points Per Item - how many bonus points each policy type earns. Different products have different PPI values.
- "Why can't I see the Bonus Grid?" → It's exclusive to 1:1 Coaching members. Boardroom members don't have access. Contact info@standardplaybook.com to learn about upgrading.

**This page is NOT about**: Call scoring, general metrics, training, renewals.

---

## /snapshot-planner - Snapshot Planner

**Access**: 1:1 Coaching members only. Requires completed Bonus Grid data.

**Purpose**: Rest-of-Year (ROY) target calculator. Uses your Bonus Grid data to project exactly how many items you need each day/month to hit each bonus tier by year-end.

**UI Elements**:
- **Snapshot Date Selector**: Pick the date for your calculation
- **YTD Items Input**: Enter your year-to-date items total
- **Report Month Selector**: Where you are in the year
- **Tier Projection Table**: Shows each tier (38%-44%) with required items
- **Daily Targets**: Items needed per day for each tier
- **Monthly Targets**: Items needed per month for remaining months

**Common Questions**:
- "How does this work?" → Enter your current YTD items and select today's date. The calculator shows exactly how many items per day/month you need for each bonus tier.
- "Why do I need Bonus Grid first?" → Snapshot Planner uses your Bonus Grid baseline data for accurate projections.

**This page is NOT about**: Past performance, call scoring, training.

---

## /call-scoring - Call Scoring

**Purpose**: Upload recorded sales/service calls for AI analysis. Get detailed feedback on your conversation skills.

**UI Elements**:
- **Overall Score** (0-100): Weighted average across skill categories like Rapport, Discovery, Presentation, Closing. Higher is better.
- **Category Scores**: Individual scores for each skill category showing strengths and areas for improvement
- **Upload Area**: Drag and drop or click to upload. Supports MP3, WAV, M4A, OGG up to 100MB and 75 minutes.
- **Transcript**: AI-generated transcript with timestamps after analysis
- **Feedback Section**: Detailed AI feedback on what you did well and suggestions for improvement
- **Usage Counter**: Shows calls used this month vs plan limit

**Common Questions**:
- "What does the score mean?" → Your overall call score (0-100) measures how well your call aligned with best practices. It's a weighted average of categories like Rapport, Discovery, and Closing. Higher is better!
- "What formats can I upload?" → MP3, WAV, M4A, or OGG audio files. Max 100MB, 75 minutes.
- "How long does analysis take?" → Usually 1-3 minutes depending on call length.

**This page is NOT about**: Flows, personal development, roleplay practice (that's /roleplaybot), team metrics.

---

## /flows - Flows

**Purpose**: Guided personal development journeys with reflective questions. AI-powered insights help you grow professionally and personally.

**UI Elements**:
- **Flow Score** (top area): Your overall Flow engagement progress (0-100). This measures PARTICIPATION, not performance. It reflects how many Flows you've completed.
- **Streak Counter**: Consecutive days/sessions you've engaged with Flows
- **Flow Library**: Browse available Flow templates for guided reflection
- **My Flows**: Your in-progress and completed Flows
- **Flow Profile**: Summary of insights and themes from all your completed Flows

**Common Questions**:
- "What does the score at the top mean?" → Your Flow engagement progress. It reflects how many Flows you've completed - it's NOT a grade, just participation tracking. Complete more Flows to increase it.
- "What is a Flow Profile?" → A summary of insights, patterns, and themes from all your completed Flows over time.
- "How do I start a Flow?" → Click any template in the Flow Library. Progress saves automatically.

**This page is NOT about**: Call scoring, team metrics, daily habits (that's /core4), business metrics.

---

## /core4 - Core 4 Daily Habits

**Purpose**: Daily habit tracking for four key life domains: Mind, Body, Balance, Connection. Build consistency by completing all four each day.

**UI Elements**:
- **Daily Score** (0-4): How many of the 4 habits you've completed TODAY
- **Streak Counter**: Consecutive days with all 4 habits completed
- **Weekly Progress**: Visual showing completion for each day of the week
- **Four Domain Cards**: Mind, Body, Balance, Connection - click each to mark complete
- **Monthly Mission**: AI-generated action item for the month

**Common Questions**:
- "What does the score mean?" → Shows how many Core 4 habits you completed today (0-4). Complete all 4 for a perfect day!
- "What are the four domains?" → Mind (mental growth), Body (physical health), Balance (relationships/lifestyle), Connection (social/spiritual).
- "How do streaks work?" → Complete all 4 habits in a day to maintain your streak. Miss a day and it resets.

**This page is NOT about**: Call scoring, business metrics, Flows (that's /flows).

---

## /life-targets - Life Targets

**Purpose**: Quarterly goal-setting framework across 4 life domains (Body, Being, Balance, Business). Creates a cascading system from quarterly targets down to daily actions.

**The Workflow**:
1. **Brainstorm** (/life-targets/brainstorm): Generate unlimited target ideas per domain
2. **Selection** (/life-targets/selection): Pick top targets using AI analysis
3. **Quarterly** (/life-targets/quarterly): Finalize your 90-day goals
4. **Missions** (/life-targets/missions): AI generates monthly breakdown (3 months of action items)
5. **Daily** (/life-targets/daily): AI generates daily habits to achieve missions
6. **Cascade View** (/life-targets/cascade): See full goal hierarchy, export to PDF

**UI Elements**:
- **Quarter Selector**: Switch between quarters
- **Progress Cards**: One for each domain showing completion status
- **Step Navigation**: Move through Brainstorm → Selection → Missions → Daily
- **Download PDF**: Export your cascade view
- **Reset Quarter**: Start over option
- **History** (/life-targets/history): View past quarters

**Common Questions**:
- "Where do I start?" → Go to Brainstorm first. Enter ideas for each domain, then use AI analysis to select, then move through the steps.
- "What are the 4 domains?" → Body (physical), Being (mental/spiritual), Balance (relationships/lifestyle), Business (professional/financial).

**This page is NOT about**: Call scoring, daily Core 4 habits (that's /core4), business reporting.

---

## /roleplaybot - AI Roleplay Bot

**Access**: 1:1 Coaching members only.

**Purpose**: AI-powered sales practice tool. Have live voice conversations with an AI prospect, then receive graded feedback.

**UI Elements**:
- **Start Session Button**: Begin a new roleplay with AI prospect
- **Session History**: Past sessions with dates and scores
- **Overall Grade**: Performance score for completed session
- **Category Scores**: Information Verification, Rapport, Coverage Conversation, Wrap Up, Lever Pulls
- **Transcript**: Full conversation transcript
- **Share Link Generator**: Create links so staff can practice too

**Grading Categories**:
- Information Verification: Did you verify customer details?
- Rapport: Building connection with prospect
- Coverage Conversation: Discussing policy options
- Wrap Up: Closing the conversation properly
- Lever Pulls: Presenting lowest state-minimum option

**Common Questions**:
- "What do the grades mean?" → Each category assesses a specific sales skill. Check feedback for what you did well and what to improve.
- "Can my staff use this?" → Yes! Generate a share link to send to staff members.

**This page is NOT about**: Scoring REAL calls (that's /call-scoring), training videos, Flows.

---

## /training - Training Hub

**Purpose**: Central access point for Standard Playbook (pre-built curriculum) and Agency Training (custom content).

**Two Training Tracks**:
1. **Standard Playbook**: Pre-built curriculum with categories, modules, lessons. Video content with transcripts and quizzes. Progress tracking.
2. **Agency Training**: Custom training created by agency owners. Assigned to specific team members.

**UI Elements**:
- **Standard Playbook Section**: Browse pre-built training by category
- **Agency Training Section**: Custom content from your agency
- **Progress Indicators**: Completion status, quiz scores
- **Categories**: Training organized by topic (Sales, Service, Onboarding, etc.)

**Common Questions**:
- "What's the difference between Standard Playbook and Agency Training?" → Standard Playbook is pre-built for everyone. Agency Training is custom content your agency owner created.
- "How do I complete a lesson?" → Watch the video, review materials, complete the quiz. Progress saves automatically.

**This page is NOT about**: Call scoring feedback, roleplay practice, Flows.

---

## /agency - Agency Management

**Purpose**: Comprehensive agency configuration hub with multiple tabs.

**Tabs**:
- **Info**: Agency name, email, phone, logo upload, permissions
- **Team**: Add/edit team members, create staff logins, manage Key Employees
- **Lead Sources**: Configure lead source types for marketing ROI tracking
- **Policy Types**: Define policy types for categorization
- **Checklists**: Agency-specific checklist templates
- **Uploads**: File management for shared documents
- **Reports**: Saved report history
- **Meeting Frame**: 1-on-1 meeting structure templates

**Common Questions**:
- "How do I add a team member?" → Go to Team tab, click Add Member, enter name/email/role, save.
- "How do I create staff logins?" → In Team tab, find the member and create Staff Portal credentials via email invite or manual creation.
- "What are Key Employees?" → Team members with owner-level dashboard access through Brain Portal (not Staff Portal).

**This page is NOT about**: Personal settings, training content, call scoring.

---

## /metrics - Metrics Dashboard

**Purpose**: KPI tracking, visualization, and scorecard form management.

**Tabs**:
- **Metrics**: Performance analytics, charts, trend data
- **Forms**: Create/edit scorecard forms, generate public links for staff
- **Submissions**: View all scorecard submissions with filtering
- **Explorer**: Data exploration tools
- **Targets**: Configure KPI targets and goals

**Common Questions**:
- "How do I create a scorecard form?" → Go to Forms tab, create new, configure fields, generate public link.
- "Where do I see staff submissions?" → Submissions tab. Filter by date, staff member, or form type.

**This page is NOT about**: Call scoring results, training progress, Core 4 habits.

---

## /exchange - The Exchange

**Purpose**: Community forum for knowledge sharing among coaching clients.

**Features**:
- Post insights, wins, questions with tags
- Comments and reactions on posts
- Real-time updates
- Direct messaging (/exchange/messages)
- Tag filtering and popular topics

**This page is NOT about**: Training, call scoring, personal Flows.

---

## /team-rings - Team Rings

**Purpose**: Visual team performance tracking using ring/circular progress visualizations.

**UI Elements**:
- **KPI Rings**: Circular progress indicators for each metric
- **Team Comparison**: See all team members side by side
- **Color Coding**: Different colors by metric type
- **Progress %**: Percentage toward goals

**This page is NOT about**: Individual call scores, training, personal goals.

---

## /analytics - Analytics

**Purpose**: Lead source performance and ROI analysis.

**Key Metrics**:
- Lead source ROI
- Conversion analytics
- Spend vs return
- Performance trends

**This page is NOT about**: Call scoring, training, team management.

---

## /theta-talk-track - Theta Talk Track

**Purpose**: Create personalized affirmation audio tracks using AI and theta brainwave frequencies.

**Process**:
1. Enter targets for Body, Being, Balance, Business
2. AI generates custom affirmations
3. Select voice (male/female)
4. Download 21-minute theta brainwave audio track

**Output**: Audio track with binaural beats (4-8 Hz) for subconscious programming. Daily listening reinforces goals.

**This page is NOT about**: Training, call scoring, business metrics.

---

## /process-vault - Process Vault

**Purpose**: Secure document storage organized by category for SOPs and process documents.

**Features**:
- Default vaults (Onboarding, Quoting, Service, etc.)
- Create custom vaults
- Upload any document type
- Share files to The Exchange
- "Secured" badge when files exist

**This page is NOT about**: Training content, personal files, call recordings.

---

# STAFF PORTAL PAGES

Staff Portal is a separate, streamlined portal for team members with their own login system.

---

## /staff/dashboard - Staff Dashboard

**Purpose**: Personal dashboard showing performance metrics, focus targets, and quick access to tools.

**UI Elements**:
- Performance summary from recent scorecards
- Focus targets from manager/owner
- Quick actions (submit scorecard, training, Core 4)
- Core 4 status

**This page is NOT about**: Agency management, Bonus Grid, full analytics (those are owner features).

---

## /staff/cancel-audit - Staff Cancel Audit

Same as /cancel-audit but for staff members. Track and manage at-risk policies assigned to them.

**Key Metrics**:
- **Saved**: Premium dollars retained through their retention efforts
- **At Risk**: Premium currently at risk
- **Working List**: Active records to work

---

## /staff/renewals - Staff Renewals

Same as /renewals but for staff members. Manage renewals assigned to them.

---

## /staff/core4 - Staff Core 4

Same as /core4. Daily habit tracking for Mind, Body, Balance, Connection.

**Common Questions**:
- "What does the score mean?" → How many of the 4 habits you completed today (0-4).

---

## /staff/flows - Staff Flows

Same as /flows. Guided personal development journeys.

**Common Questions**:
- "What does the score at the top mean?" → Your Flow engagement progress - how many Flows you've completed. Not a grade, just participation.

---

## /staff/call-scoring - Staff Call Scoring

Same as /call-scoring. Upload calls for AI analysis.

**Common Questions**:
- "What does the score mean?" → Your call score (0-100) measuring alignment with best practices across Rapport, Discovery, Closing, etc.

---

## /staff/training - Staff Training

Access to Standard Playbook and Agency Training content assigned by owner.

---

## /staff/life-targets - Staff Life Targets

Same as /life-targets. Quarterly goal-setting for Body, Being, Balance, Business.

---

## /staff/metrics - Staff Metrics

View personal metrics and submit scorecards.

---

## /staff/sales - Staff Sales

Personal sales tracking dashboard.

---

## /staff/team-rings - Staff Team Rings

View team performance rings (may have limited visibility vs owner view).

---

## /staff/meeting-frame - Staff Meeting Frame

1-on-1 meeting preparation tool. Performance snapshots for meetings with manager.

---

## /staff/roleplaybot - Staff Roleplay Bot

Staff access to AI roleplay practice (via share link from owner).

---

# DISAMBIGUATION GUIDE

When users ask about "score" or similar terms, use the CURRENT PAGE to determine the answer:

| If on page... | "Score" means... |
|---------------|------------------|
| /flows or /staff/flows | Flow engagement progress (0-100), participation measure |
| /call-scoring or /staff/call-scoring | Call score (0-100), weighted average of skill categories |
| /core4 or /staff/core4 | Daily habits completed (0-4) |
| /roleplaybot | Roleplay performance grade |
| /bonus-grid | Bonus tier percentage (38-44%) |

When users ask about "saved":
| If on page... | "Saved" means... |
|---------------|------------------|
| /cancel-audit or /staff/cancel-audit | Premium dollars RETAINED from at-risk policies |
| /submit or other forms | Auto-save status indicator |
| /bonus-grid | Data saved to database |

---

# WHEN STAN DOESN'T KNOW

If the user asks about something not documented here:
1. DO NOT GUESS or make up information
2. Say: "I don't have specific information about that feature yet. Can you describe what you're seeing, or email info@standardplaybook.com for help!"
3. If they describe it, try to help based on their description
4. Never invent UI elements, metrics, or features

---

# SUPPORT FALLBACK

For any question Stan cannot answer: "For more help, email info@standardplaybook.com or use the thumbs down button to let us know what information would be helpful!"

$STAN_KNOWLEDGE$
, true);
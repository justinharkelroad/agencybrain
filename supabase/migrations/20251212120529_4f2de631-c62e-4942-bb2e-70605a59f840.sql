-- Call Scoring Module: Phase 1A Database Foundation

-- Scoring prompt templates (Admin-created only)
CREATE TABLE call_scoring_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  output_schema JSONB,
  skill_categories JSONB NOT NULL DEFAULT '["Rapport", "Discovery", "Coverage", "Closing", "Cross-Sell"]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call analysis results
CREATE TABLE agency_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  team_member_id UUID REFERENCES team_members(id) NOT NULL,
  template_id UUID REFERENCES call_scoring_templates(id) NOT NULL,
  
  overall_score INT,
  potential_rank TEXT,
  skill_scores JSONB,
  client_profile JSONB,
  premium_analysis JSONB,
  discovery_wins JSONB,
  section_scores JSONB,
  critical_gaps JSONB,
  closing_attempts INT,
  missed_signals JSONB,
  
  transcript TEXT,
  summary TEXT,
  call_duration_seconds INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking per billing cycle
CREATE TABLE call_usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  calls_used INT DEFAULT 0,
  calls_limit INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, billing_period_start)
);

-- Enable RLS on all tables
ALTER TABLE call_scoring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Templates: Admin only for management
CREATE POLICY "Admin can manage templates" ON call_scoring_templates
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Templates: Authenticated users can read active templates
CREATE POLICY "Users can read active templates" ON call_scoring_templates
  FOR SELECT USING (is_active = true);

-- Agency calls: Agency-scoped read
CREATE POLICY "Users see own agency calls" ON agency_calls
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

-- Agency calls: Agency-scoped insert
CREATE POLICY "Users create own agency calls" ON agency_calls
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Usage tracking: Agency-scoped
CREATE POLICY "Users see own usage" ON call_usage_tracking
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users manage own usage" ON call_usage_tracking
  FOR ALL USING (has_agency_access(auth.uid(), agency_id));

-- Seed default template
INSERT INTO call_scoring_templates (name, description, system_prompt, skill_categories) VALUES (
  'Standard Insurance Sales Review',
  'Default template for analyzing insurance sales calls',
  'You are an expert insurance sales coach. Analyze this sales call transcript and return ONLY valid JSON.

ANALYSIS REQUIREMENTS:
1. Score each skill category 1-10
2. Identify the client''s motivation and pain points
3. Extract any premium numbers mentioned (old vs new/proposed)
4. Count properties/assets discovered (rentals, vehicles, etc.)
5. Identify missed closing signals (quotes from client showing buying intent)
6. Provide specific, actionable coaching tips

Return a JSON object with: overall_score (0-100), potential_rank ("Very High"/"High"/"Medium"/"Low"), skill_scores (object with rapport/discovery/coverage/closing/cross_sell each 1-10), client_profile (motivation, pain_point, assets array), premium_analysis (home/auto with old/new values), discovery_wins (count, items array, summary), sections (rapport/coverage/closing each with status/summary/coaching_directive), critical_gaps (array of title/detail objects).',
  '["Rapport", "Discovery", "Coverage", "Closing", "Cross-Sell"]'
);
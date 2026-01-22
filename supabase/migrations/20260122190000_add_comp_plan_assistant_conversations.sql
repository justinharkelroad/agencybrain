-- Create table for storing comp plan assistant conversations
CREATE TABLE IF NOT EXISTS comp_plan_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]'::jsonb,
  extracted_config JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_comp_plan_assistant_conversations_user
  ON comp_plan_assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_plan_assistant_conversations_agency
  ON comp_plan_assistant_conversations(agency_id);
CREATE INDEX IF NOT EXISTS idx_comp_plan_assistant_conversations_created
  ON comp_plan_assistant_conversations(created_at DESC);

-- Enable RLS
ALTER TABLE comp_plan_assistant_conversations ENABLE ROW LEVEL SECURITY;

-- Users can see their own conversations
CREATE POLICY "Users can view own conversations"
  ON comp_plan_assistant_conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
  ON comp_plan_assistant_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON comp_plan_assistant_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for edge function)
CREATE POLICY "Service role full access"
  ON comp_plan_assistant_conversations FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

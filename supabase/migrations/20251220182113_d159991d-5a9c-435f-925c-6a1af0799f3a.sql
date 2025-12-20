-- Create exchange_visibility enum
CREATE TYPE exchange_visibility AS ENUM ('call_scoring', 'boardroom', 'one_on_one');

-- Create exchange_tags table (admin-managed tags)
CREATE TABLE exchange_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial tags
INSERT INTO exchange_tags (name) VALUES 
  ('Process'), ('Sales'), ('Service'), ('Culture'), ('Marketing'), ('Revenue');

-- Create exchange_posts table
CREATE TABLE exchange_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('process_vault', 'flow_result', 'saved_report', 'training_module', 'text_post', 'external_link', 'image')),
  content_text TEXT,
  file_path TEXT,
  file_name TEXT,
  external_url TEXT,
  source_reference JSONB,
  visibility exchange_visibility NOT NULL DEFAULT 'boardroom',
  is_admin_post BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for feed queries
CREATE INDEX idx_exchange_posts_visibility ON exchange_posts(visibility, created_at DESC);
CREATE INDEX idx_exchange_posts_user ON exchange_posts(user_id);

-- Create exchange_post_tags junction table
CREATE TABLE exchange_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES exchange_tags(id) ON DELETE CASCADE,
  UNIQUE(post_id, tag_id)
);

CREATE INDEX idx_exchange_post_tags_post ON exchange_post_tags(post_id);
CREATE INDEX idx_exchange_post_tags_tag ON exchange_post_tags(tag_id);

-- Create exchange_comments table (supports nesting)
CREATE TABLE exchange_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES exchange_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exchange_comments_post ON exchange_comments(post_id, created_at);
CREATE INDEX idx_exchange_comments_parent ON exchange_comments(parent_comment_id);

-- Create exchange_likes table
CREATE TABLE exchange_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_exchange_likes_post ON exchange_likes(post_id);

-- Create exchange_reports table
CREATE TABLE exchange_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Create exchange_conversations table (for DMs)
CREATE TABLE exchange_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_one, participant_two),
  CHECK (participant_one < participant_two)
);

CREATE INDEX idx_exchange_conversations_participants ON exchange_conversations(participant_one, participant_two);

-- Create exchange_messages table (DMs)
CREATE TABLE exchange_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES exchange_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exchange_messages_conversation ON exchange_messages(conversation_id, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE exchange_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_tags ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's exchange access tier
CREATE OR REPLACE FUNCTION get_user_exchange_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_membership_tier TEXT;
  v_agency_id UUID;
  v_has_call_scoring BOOLEAN;
BEGIN
  -- Get user's profile info
  SELECT role, membership_tier, agency_id 
  INTO v_role, v_membership_tier, v_agency_id
  FROM profiles WHERE id = p_user_id;
  
  -- Admin sees everything
  IF v_role = 'admin' THEN
    RETURN 'admin';
  END IF;
  
  -- Check membership tier
  IF v_membership_tier = '1:1 Coaching' THEN
    RETURN 'one_on_one';
  ELSIF v_membership_tier = 'Boardroom' THEN
    RETURN 'boardroom';
  END IF;
  
  -- Check if user has call scoring access via their agency
  IF v_agency_id IS NOT NULL THEN
    SELECT enabled INTO v_has_call_scoring 
    FROM agency_call_scoring_settings 
    WHERE agency_id = v_agency_id;
    
    IF v_has_call_scoring THEN
      RETURN 'call_scoring';
    END IF;
  END IF;
  
  -- Check key employee's linked agency
  SELECT ke.agency_id INTO v_agency_id
  FROM key_employees ke WHERE ke.user_id = p_user_id;
  
  IF v_agency_id IS NOT NULL THEN
    -- Get the agency owner's tier
    SELECT p.membership_tier INTO v_membership_tier
    FROM profiles p
    WHERE p.agency_id = v_agency_id AND p.role != 'admin'
    LIMIT 1;
    
    IF v_membership_tier = '1:1 Coaching' THEN
      RETURN 'one_on_one';
    ELSIF v_membership_tier = 'Boardroom' THEN
      RETURN 'boardroom';
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Posts: Users can see posts based on their tier
CREATE POLICY "Users can view posts based on tier" ON exchange_posts
  FOR SELECT USING (
    CASE get_user_exchange_tier(auth.uid())
      WHEN 'admin' THEN true
      WHEN 'one_on_one' THEN true
      WHEN 'boardroom' THEN visibility IN ('boardroom', 'call_scoring')
      WHEN 'call_scoring' THEN visibility = 'call_scoring'
      ELSE false
    END
  );

-- Posts: Users can insert their own posts
CREATE POLICY "Users can create posts" ON exchange_posts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND get_user_exchange_tier(auth.uid()) IS NOT NULL
  );

-- Posts: Users can update their own posts
CREATE POLICY "Users can update own posts" ON exchange_posts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Posts: Users can delete their own posts, admins can delete any
CREATE POLICY "Users can delete own posts" ON exchange_posts
  FOR DELETE USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Tags: Everyone with exchange access can view active tags
CREATE POLICY "Users can view active tags" ON exchange_tags
  FOR SELECT USING (
    is_active = true 
    AND get_user_exchange_tier(auth.uid()) IS NOT NULL
  );

-- Tags: Only admins can manage tags
CREATE POLICY "Admins can manage tags" ON exchange_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Post tags: Follow post visibility
CREATE POLICY "Users can view post tags" ON exchange_post_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exchange_posts ep 
      WHERE ep.id = post_id
    )
  );

-- Post tags: Post owner can manage
CREATE POLICY "Post owner can manage tags" ON exchange_post_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM exchange_posts ep 
      WHERE ep.id = post_id AND ep.user_id = auth.uid()
    )
  );

-- Comments: Follow post visibility
CREATE POLICY "Users can view comments" ON exchange_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM exchange_posts ep WHERE ep.id = post_id)
  );

-- Comments: Users can create comments on visible posts
CREATE POLICY "Users can create comments" ON exchange_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM exchange_posts ep WHERE ep.id = post_id)
  );

-- Comments: Users can update own comments
CREATE POLICY "Users can update own comments" ON exchange_comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comments: Users can delete own comments, admins can delete any
CREATE POLICY "Users can delete own comments" ON exchange_comments
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Likes: Follow post visibility
CREATE POLICY "Users can view likes" ON exchange_likes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM exchange_posts ep WHERE ep.id = post_id)
  );

-- Likes: Users can manage own likes
CREATE POLICY "Users can manage own likes" ON exchange_likes
  FOR ALL USING (auth.uid() = user_id);

-- Reports: Users can create reports
CREATE POLICY "Users can create reports" ON exchange_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

-- Reports: Only admins can view/manage reports
CREATE POLICY "Admins can manage reports" ON exchange_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Conversations: Participants can view their conversations
CREATE POLICY "Users can view own conversations" ON exchange_conversations
  FOR SELECT USING (
    auth.uid() = participant_one OR auth.uid() = participant_two
  );

-- Conversations: Users can create conversations
CREATE POLICY "Users can create conversations" ON exchange_conversations
  FOR INSERT WITH CHECK (
    auth.uid() = participant_one OR auth.uid() = participant_two
  );

-- Messages: Participants can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations" ON exchange_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exchange_conversations ec 
      WHERE ec.id = conversation_id 
      AND (ec.participant_one = auth.uid() OR ec.participant_two = auth.uid())
    )
  );

-- Messages: Users can send messages in their conversations
CREATE POLICY "Users can send messages" ON exchange_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM exchange_conversations ec 
      WHERE ec.id = conversation_id 
      AND (ec.participant_one = auth.uid() OR ec.participant_two = auth.uid())
    )
  );

-- Messages: Users can update read_at on messages sent to them
CREATE POLICY "Users can mark messages as read" ON exchange_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM exchange_conversations ec 
      WHERE ec.id = conversation_id 
      AND (ec.participant_one = auth.uid() OR ec.participant_two = auth.uid())
      AND sender_id != auth.uid()
    )
  );
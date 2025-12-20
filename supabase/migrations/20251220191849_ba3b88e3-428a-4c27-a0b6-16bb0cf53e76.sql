-- Add pinned columns to exchange_posts
ALTER TABLE exchange_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE exchange_posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE exchange_posts ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES auth.users(id);

-- Index for efficient pinned post queries
CREATE INDEX IF NOT EXISTS idx_exchange_posts_pinned ON exchange_posts(is_pinned, pinned_at DESC) WHERE is_pinned = true;

-- Create exchange_post_views table for tracking read status
CREATE TABLE IF NOT EXISTS exchange_post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE exchange_post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own views" ON exchange_post_views
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exchange_post_views_user ON exchange_post_views(user_id, viewed_at DESC);
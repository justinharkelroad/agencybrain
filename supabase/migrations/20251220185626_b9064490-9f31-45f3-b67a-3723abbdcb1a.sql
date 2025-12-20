-- Add column for private shares
ALTER TABLE exchange_posts ADD COLUMN IF NOT EXISTS private_recipient_id UUID REFERENCES auth.users(id);

-- Update RLS policy to include private shares
DROP POLICY IF EXISTS "Users can view posts based on tier" ON exchange_posts;

CREATE POLICY "Users can view posts based on tier or if private recipient" ON exchange_posts
  FOR SELECT USING (
    -- Private share to this user
    private_recipient_id = auth.uid()
    OR
    -- Public post with tier-based visibility (existing logic)
    (
      private_recipient_id IS NULL
      AND
      CASE get_user_exchange_tier(auth.uid())
        WHEN 'admin' THEN true
        WHEN 'one_on_one' THEN true
        WHEN 'boardroom' THEN visibility IN ('boardroom', 'call_scoring')
        WHEN 'call_scoring' THEN visibility = 'call_scoring'
        ELSE false
      END
    )
    OR
    -- Own post
    user_id = auth.uid()
  );

-- Index for private recipient queries
CREATE INDEX IF NOT EXISTS idx_exchange_posts_private_recipient ON exchange_posts(private_recipient_id) WHERE private_recipient_id IS NOT NULL;
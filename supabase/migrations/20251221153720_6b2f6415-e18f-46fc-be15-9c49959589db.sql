-- Track when user last viewed the exchange feed
CREATE TABLE exchange_user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_feed_view TIMESTAMPTZ DEFAULT now(),
  last_notifications_view TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE exchange_user_activity ENABLE ROW LEVEL SECURITY;

-- Users can only access their own activity
CREATE POLICY "Users can manage own activity" ON exchange_user_activity
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_exchange_user_activity_user ON exchange_user_activity(user_id);

-- Create or update activity record function
CREATE OR REPLACE FUNCTION upsert_exchange_activity(
  p_user_id UUID,
  p_update_feed BOOLEAN DEFAULT false,
  p_update_notifications BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  INSERT INTO exchange_user_activity (user_id, last_feed_view, last_notifications_view)
  VALUES (
    p_user_id,
    CASE WHEN p_update_feed THEN now() ELSE '1970-01-01'::timestamptz END,
    CASE WHEN p_update_notifications THEN now() ELSE '1970-01-01'::timestamptz END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    last_feed_view = CASE WHEN p_update_feed THEN now() ELSE exchange_user_activity.last_feed_view END,
    last_notifications_view = CASE WHEN p_update_notifications THEN now() ELSE exchange_user_activity.last_notifications_view END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
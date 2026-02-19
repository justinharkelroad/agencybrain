-- Tracks which promotional banners a user has dismissed
CREATE TABLE IF NOT EXISTS banner_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, banner_key)
);

ALTER TABLE banner_dismissals ENABLE ROW LEVEL SECURITY;

-- Users can read their own dismissals
CREATE POLICY "Users can read own dismissals"
  ON banner_dismissals FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own dismissals
CREATE POLICY "Users can insert own dismissals"
  ON banner_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

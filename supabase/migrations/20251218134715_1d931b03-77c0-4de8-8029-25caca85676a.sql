-- Training lesson comments table
CREATE TABLE IF NOT EXISTS training_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES training_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_training_comments_lesson ON training_comments(lesson_id);
CREATE INDEX idx_training_comments_parent ON training_comments(parent_id);

-- RLS Policies
ALTER TABLE training_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view comments
CREATE POLICY "Users can view training comments"
ON training_comments FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can create comments"
ON training_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON training_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON training_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
-- Create video_training_modules table (renamed to avoid conflict with existing training_modules)
CREATE TABLE IF NOT EXISTS public.video_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('leader', 'community')),
  used_in_huddle BOOLEAN DEFAULT false,
  video_storage_path TEXT,
  video_deleted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_training_modules ENABLE ROW LEVEL SECURITY;

-- Users can only see their agency's video training modules
CREATE POLICY "Users can view their agency video training modules"
  ON public.video_training_modules
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert video training modules for their agency
CREATE POLICY "Users can create video training modules"
  ON public.video_training_modules
  FOR INSERT
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Users can update their own video training modules
CREATE POLICY "Users can update own video training modules"
  ON public.video_training_modules
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own video training modules
CREATE POLICY "Users can delete own video training modules"
  ON public.video_training_modules
  FOR DELETE
  USING (user_id = auth.uid());

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_video_training_modules_agency ON public.video_training_modules(agency_id);
CREATE INDEX IF NOT EXISTS idx_video_training_modules_user ON public.video_training_modules(user_id);
CREATE INDEX IF NOT EXISTS idx_video_training_modules_created ON public.video_training_modules(created_at DESC);
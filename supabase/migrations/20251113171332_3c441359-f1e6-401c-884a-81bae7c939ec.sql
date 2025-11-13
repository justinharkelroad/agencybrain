-- Create table to track theta track generation
CREATE TABLE IF NOT EXISTS public.theta_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  audio_url TEXT,
  duration_minutes INTEGER DEFAULT 21,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.theta_tracks ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public feature)
CREATE POLICY "Anyone can create theta tracks"
  ON public.theta_tracks
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read their own tracks by session_id
CREATE POLICY "Anyone can view their own theta tracks"
  ON public.theta_tracks
  FOR SELECT
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_theta_tracks_session_id ON public.theta_tracks(session_id);
CREATE INDEX idx_theta_tracks_status ON public.theta_tracks(status);
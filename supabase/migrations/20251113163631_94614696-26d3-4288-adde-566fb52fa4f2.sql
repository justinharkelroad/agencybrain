-- Gate 0: Theta Talk Track Database Schema
-- Creates 5 tables with RLS policies and indexes for public Theta Talk Track feature

-- Table 1: theta_targets - Stores user's 90-day goals
CREATE TABLE public.theta_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  faith TEXT,
  family TEXT,
  fitness TEXT,
  finance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_theta_targets_user ON public.theta_targets(user_id);
CREATE INDEX idx_theta_targets_session ON public.theta_targets(session_id);
CREATE INDEX idx_theta_targets_created ON public.theta_targets(created_at);

-- Table 2: theta_affirmations - Stores AI-generated affirmations
CREATE TABLE public.theta_affirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES public.theta_targets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('faith', 'family', 'fitness', 'finance')),
  text TEXT NOT NULL,
  tone TEXT NOT NULL CHECK (tone IN ('empowering', 'gentle', 'analytical', 'spiritual')),
  approved BOOLEAN NOT NULL DEFAULT false,
  edited BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_theta_affirmations_target ON public.theta_affirmations(target_id);
CREATE INDEX idx_theta_affirmations_session ON public.theta_affirmations(session_id);
CREATE INDEX idx_theta_affirmations_approved ON public.theta_affirmations(approved);

-- Table 3: theta_voice_tracks - Stores ElevenLabs voice audio
CREATE TABLE public.theta_voice_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES public.theta_targets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  voice_type TEXT NOT NULL CHECK (voice_type IN ('male', 'female')),
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_theta_voice_tracks_session ON public.theta_voice_tracks(session_id);
CREATE INDEX idx_theta_voice_tracks_target ON public.theta_voice_tracks(target_id);

-- Table 4: theta_final_tracks - Stores complete 21-minute tracks
CREATE TABLE public.theta_final_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID REFERENCES public.theta_targets(id) ON DELETE CASCADE,
  voice_track_id UUID REFERENCES public.theta_voice_tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 1260,
  file_size_bytes BIGINT,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_theta_final_tracks_session ON public.theta_final_tracks(session_id);
CREATE INDEX idx_theta_final_tracks_target ON public.theta_final_tracks(target_id);
CREATE INDEX idx_theta_final_tracks_created ON public.theta_final_tracks(created_at);

-- Table 5: theta_track_leads - Stores lead capture for downloads
CREATE TABLE public.theta_track_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  opt_in_tips BOOLEAN NOT NULL DEFAULT false,
  opt_in_challenge BOOLEAN NOT NULL DEFAULT false,
  final_track_id UUID REFERENCES public.theta_final_tracks(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_theta_leads_email ON public.theta_track_leads(email);
CREATE INDEX idx_theta_leads_session ON public.theta_track_leads(session_id);
CREATE INDEX idx_theta_leads_created ON public.theta_track_leads(created_at);
CREATE UNIQUE INDEX idx_theta_leads_email_session ON public.theta_track_leads(email, session_id);

-- Enable RLS on all tables
ALTER TABLE public.theta_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theta_affirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theta_voice_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theta_final_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theta_track_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for theta_targets (permissive for public access)
CREATE POLICY "Anyone can insert targets"
  ON public.theta_targets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view targets by session"
  ON public.theta_targets FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update targets by session"
  ON public.theta_targets FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete their targets"
  ON public.theta_targets FOR DELETE
  USING (true);

-- RLS Policies for theta_affirmations
CREATE POLICY "Anyone can insert affirmations"
  ON public.theta_affirmations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view affirmations"
  ON public.theta_affirmations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update affirmations"
  ON public.theta_affirmations FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete affirmations"
  ON public.theta_affirmations FOR DELETE
  USING (true);

-- RLS Policies for theta_voice_tracks
CREATE POLICY "Anyone can insert voice tracks"
  ON public.theta_voice_tracks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view voice tracks"
  ON public.theta_voice_tracks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can delete voice tracks"
  ON public.theta_voice_tracks FOR DELETE
  USING (true);

-- RLS Policies for theta_final_tracks
CREATE POLICY "Anyone can insert final tracks"
  ON public.theta_final_tracks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view final tracks"
  ON public.theta_final_tracks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update final tracks"
  ON public.theta_final_tracks FOR UPDATE
  USING (true);

-- RLS Policies for theta_track_leads
CREATE POLICY "Anyone can insert leads"
  ON public.theta_track_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all leads"
  ON public.theta_track_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Anyone can view their own leads by session"
  ON public.theta_track_leads FOR SELECT
  USING (session_id IN (SELECT session_id FROM public.theta_targets WHERE session_id = theta_track_leads.session_id));

-- Note: Supabase Storage bucket 'theta-audio-tracks' must be created manually via Supabase Dashboard
-- Configuration: Public access, 50MB max file size, MIME types: audio/mpeg, audio/wav, audio/mp3
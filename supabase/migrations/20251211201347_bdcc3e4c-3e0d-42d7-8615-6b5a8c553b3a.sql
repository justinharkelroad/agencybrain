-- Create help_videos table
CREATE TABLE help_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_key text UNIQUE NOT NULL,
  title text NOT NULL,
  url text NOT NULL DEFAULT '',
  video_type text NOT NULL DEFAULT 'youtube' CHECK (video_type IN ('youtube', 'loom')),
  placement_description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE help_videos ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active help videos
CREATE POLICY "Anyone can read active help videos" 
ON help_videos FOR SELECT 
USING (is_active = true);

-- Only admins can manage (using existing admin check pattern)
CREATE POLICY "Admins can manage help videos" 
ON help_videos FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Seed with placeholder entries for all pre-placed buttons
INSERT INTO help_videos (video_key, title, placement_description) VALUES
  ('dashboard-overview', 'Dashboard Overview', 'Next to Dashboard heading'),
  ('training-overview', 'Training Overview', 'Next to Training heading'),
  ('flows-overview', 'Flows Overview', 'Next to Flows heading'),
  ('metrics-overview', 'Metrics & Scorecards Overview', 'Next to Metrics heading'),
  ('tool-quarterly-targets', 'Setting Quarterly Targets', 'Inside Quarterly Targets tool, next to title'),
  ('tool-theta-talk-track', 'Using Theta Talk Track', 'Inside Theta Talk Track tool, next to title'),
  ('tool-lead-source-manager', 'Managing Lead Sources', 'Inside Lead Source Manager tool, next to title'),
  ('tool-policy-type-manager', 'Managing Policy Types', 'Inside Policy Type Manager tool, next to title'),
  ('agency-information', 'Agency Setup & Information', 'Next to Agency Information heading in My Agency');
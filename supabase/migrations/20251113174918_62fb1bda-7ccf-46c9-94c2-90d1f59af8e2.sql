-- Update theta_affirmations tone CHECK constraint to match new tone values
-- Old values: empowering, gentle, analytical, spiritual
-- New values: inspiring, motivational, calm, energizing

ALTER TABLE public.theta_affirmations 
  DROP CONSTRAINT IF EXISTS theta_affirmations_tone_check;

ALTER TABLE public.theta_affirmations 
  ADD CONSTRAINT theta_affirmations_tone_check 
  CHECK (tone IN ('inspiring', 'motivational', 'calm', 'energizing'));
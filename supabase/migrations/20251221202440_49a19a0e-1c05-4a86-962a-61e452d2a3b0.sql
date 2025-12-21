ALTER TABLE flow_profiles
ADD COLUMN IF NOT EXISTS accountability_style text,
ADD COLUMN IF NOT EXISTS feedback_preference text,
ADD COLUMN IF NOT EXISTS peak_state text,
ADD COLUMN IF NOT EXISTS growth_edge text,
ADD COLUMN IF NOT EXISTS overwhelm_response text;
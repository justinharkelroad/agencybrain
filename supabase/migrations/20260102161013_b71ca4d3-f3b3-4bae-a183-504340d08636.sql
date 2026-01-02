-- Add impersonation columns to staff_sessions
ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS is_impersonation BOOLEAN DEFAULT false;
ALTER TABLE staff_sessions ADD COLUMN IF NOT EXISTS impersonated_by UUID REFERENCES auth.users(id);
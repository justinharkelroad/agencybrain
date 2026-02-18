-- Add AI training content generator feature flag to agencies
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS ai_training_enabled boolean NOT NULL DEFAULT false;

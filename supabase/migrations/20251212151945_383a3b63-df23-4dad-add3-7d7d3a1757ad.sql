-- Add analysis result columns to agency_calls if they don't exist
ALTER TABLE agency_calls 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Note: coaching_recommendations and notable_quotes will be stored in premium_analysis JSONB column which already exists
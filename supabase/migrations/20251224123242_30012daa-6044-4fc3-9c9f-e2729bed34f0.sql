-- Add source tracking columns to focus_items
ALTER TABLE focus_items 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS source_session_id UUID DEFAULT NULL REFERENCES flow_sessions(id) ON DELETE SET NULL;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_focus_items_source_type ON focus_items(source_type);

COMMENT ON COLUMN focus_items.source_type IS 'Origin of focus item: "flow", "manual", etc.';
COMMENT ON COLUMN focus_items.source_name IS 'Name of source (e.g., "Grateful Flow", "Irritation Flow")';
COMMENT ON COLUMN focus_items.source_session_id IS 'Reference to flow session if created from a flow';
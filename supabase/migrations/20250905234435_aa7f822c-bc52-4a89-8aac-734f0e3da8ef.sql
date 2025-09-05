-- Clean up duplicate lead sources by keeping the most recent one for each unique name per agency
WITH duplicate_lead_sources AS (
  SELECT 
    id,
    agency_id,
    name,
    ROW_NUMBER() OVER (PARTITION BY agency_id, LOWER(TRIM(name)) ORDER BY created_at DESC) as rn
  FROM lead_sources
)
DELETE FROM lead_sources 
WHERE id IN (
  SELECT id 
  FROM duplicate_lead_sources 
  WHERE rn > 1
);

-- Update order_index to ensure proper ordering after cleanup
WITH ordered_sources AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY agency_id ORDER BY name ASC) - 1 as new_order
  FROM lead_sources
  WHERE is_active = true
)
UPDATE lead_sources 
SET order_index = ordered_sources.new_order
FROM ordered_sources
WHERE lead_sources.id = ordered_sources.id;
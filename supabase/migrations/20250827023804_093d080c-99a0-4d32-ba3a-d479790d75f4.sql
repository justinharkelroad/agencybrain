-- Add default lead sources for agencies that don't have any
INSERT INTO lead_sources (agency_id, name, is_active, order_index)
SELECT DISTINCT 
  a.id as agency_id,
  src.name,
  true as is_active,
  src.order_index
FROM agencies a
CROSS JOIN (
  VALUES 
    ('Referral', 1),
    ('Cold Call', 2), 
    ('Website Inquiry', 3),
    ('Social Media', 4),
    ('Walk-in', 5),
    ('Warm Lead', 6),
    ('Existing Customer', 7),
    ('Partner Referral', 8)
) AS src(name, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM lead_sources ls 
  WHERE ls.agency_id = a.id 
  AND ls.name = src.name
);
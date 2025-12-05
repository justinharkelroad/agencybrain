-- Fix historical quoted_household_details records where lead_source_label contains a UUID
UPDATE quoted_household_details qhd
SET lead_source_label = ls.name
FROM lead_sources ls
WHERE qhd.lead_source_label = ls.id::text
  AND qhd.lead_source_label IS NOT NULL;
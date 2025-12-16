-- Link Rbroussard's profile to their agency
-- First, find any profile without agency_id and link to Broussard Agency
-- Profile with NULL agency_id: a169dbdc-acce-4aed-8474-2e55895fb280
-- Broussard Agency ID: c7985912-6f5b-42ba-b25e-9f29dda2269c

UPDATE profiles 
SET agency_id = 'c7985912-6f5b-42ba-b25e-9f29dda2269c'
WHERE id = 'a169dbdc-acce-4aed-8474-2e55895fb280'
  AND agency_id IS NULL;
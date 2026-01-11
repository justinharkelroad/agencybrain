-- Make zip_code nullable in lqs_households
ALTER TABLE lqs_households 
ALTER COLUMN zip_code DROP NOT NULL;
-- Add unique constraint on agency names to prevent duplicates
ALTER TABLE public.agencies ADD CONSTRAINT unique_agency_name UNIQUE (name);
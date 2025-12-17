-- Set slug for Melissa French's agency to fix "Failed to load agency information" error
UPDATE public.agencies 
SET slug = 'melissa-french-sumner-insurance-group'
WHERE id = '2bd857f0-cbc4-4a38-ad77-8621b1b35983';
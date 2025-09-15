-- Finalize the test submission to trigger metrics creation
UPDATE submissions 
SET final = true 
WHERE id = '11111111-2222-3333-4444-555555555555';
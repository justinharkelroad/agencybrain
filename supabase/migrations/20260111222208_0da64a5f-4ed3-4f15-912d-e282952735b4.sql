-- Update lqs_sales source constraint to include 'lqs_upload'
ALTER TABLE lqs_sales DROP CONSTRAINT lqs_sales_source_check;
ALTER TABLE lqs_sales ADD CONSTRAINT lqs_sales_source_check 
CHECK (source IN ('sales_dashboard', 'scorecard', 'manual', 'lqs_upload', 'allstate_report'));

-- Clean up bad households created from sub-producer names
DELETE FROM lqs_households 
WHERE last_name IN ('REAP', 'MCDERMOTT') 
AND first_name IN ('BRETT', 'ANTHONY')
AND zip_code IS NULL;
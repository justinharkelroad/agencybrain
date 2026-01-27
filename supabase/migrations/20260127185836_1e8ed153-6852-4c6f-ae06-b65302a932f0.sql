-- Delete lqs_sales first (has FK to lqs_quotes)
DELETE FROM lqs_sales
WHERE household_id IN (
  SELECT id FROM lqs_households WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e'
);

-- Delete lqs_quotes
DELETE FROM lqs_quotes
WHERE household_id IN (
  SELECT id FROM lqs_households WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e'
);

-- Reset household status back to 'lead' since they no longer have quotes/sales
UPDATE lqs_households
SET status = 'lead', 
    first_quote_date = NULL, 
    sold_date = NULL,
    needs_attention = false
WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
-- Part 2: Clean up existing duplicate quotes
-- Delete duplicates, keeping only the earliest created record for each unique combination

DELETE FROM lqs_quotes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY household_id, quote_date, product_type, premium_cents 
             ORDER BY created_at ASC
           ) as rn
    FROM lqs_quotes
  ) sub
  WHERE rn > 1
);

-- Part 3: Add unique constraint to prevent future duplicates at DB level
ALTER TABLE lqs_quotes 
ADD CONSTRAINT unique_household_quote 
UNIQUE (household_id, quote_date, product_type, premium_cents);
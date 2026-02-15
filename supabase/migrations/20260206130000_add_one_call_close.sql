-- Add is_one_call_close boolean to sales and lqs_sales tables
-- Forward-looking only: all existing rows default to false, no backfill

ALTER TABLE sales ADD COLUMN is_one_call_close boolean NOT NULL DEFAULT false;
ALTER TABLE lqs_sales ADD COLUMN is_one_call_close boolean NOT NULL DEFAULT false;

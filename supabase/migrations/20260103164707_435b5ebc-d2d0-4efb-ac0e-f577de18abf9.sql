-- Add lead_source_id column to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES lead_sources(id);
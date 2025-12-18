-- Add daily agency goal targets
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS daily_quoted_households_target INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS daily_sold_items_target INTEGER DEFAULT 8;
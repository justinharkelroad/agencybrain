-- Add count_business_days toggle to sales_goals for promo goals
-- When true, "days remaining" calculations use Mon-Fri business days instead of calendar days
ALTER TABLE sales_goals ADD COLUMN count_business_days boolean NOT NULL DEFAULT false;

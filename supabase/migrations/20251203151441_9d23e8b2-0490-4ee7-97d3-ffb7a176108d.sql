-- Create master KPI definitions table (locked list)
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'number',
  category text NOT NULL,
  applicable_roles text[] NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert the master KPI list (14 pre-defined KPIs)
INSERT INTO kpi_definitions (slug, label, type, category, applicable_roles, sort_order) VALUES
-- Activity KPIs (both roles)
('outbound_calls', 'Outbound Calls', 'number', 'activity', ARRAY['Sales', 'Service'], 1),
('talk_minutes', 'Talk Minutes', 'number', 'activity', ARRAY['Sales', 'Service'], 2),
-- Sales Production KPIs
('quoted_households', 'Quoted Households', 'number', 'production', ARRAY['Sales'], 3),
('items_quoted', 'Items Quoted', 'number', 'production', ARRAY['Sales'], 4),
('policies_quoted', 'Policies Quoted', 'number', 'production', ARRAY['Sales'], 5),
('premium_quoted', 'Premium Quoted', 'currency', 'production', ARRAY['Sales'], 6),
-- Sales Results KPIs
('items_sold', 'Items Sold', 'number', 'results', ARRAY['Sales'], 7),
('policies_sold', 'Policies Sold', 'number', 'results', ARRAY['Sales'], 8),
('premium_sold', 'Premium Sold', 'currency', 'results', ARRAY['Sales'], 9),
('appointments_set', 'Appointments Set', 'number', 'production', ARRAY['Sales'], 10),
-- Service KPIs
('cross_sells_uncovered', 'Cross-sells Uncovered', 'number', 'production', ARRAY['Service'], 11),
('mini_reviews', 'Mini Reviews Completed', 'number', 'production', ARRAY['Service'], 12),
('endorsements_processed', 'Endorsements Processed', 'number', 'activity', ARRAY['Service'], 13),
('claims_assisted', 'Claims Assisted', 'number', 'activity', ARRAY['Service'], 14);

-- RLS - everyone can read (reference table)
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read kpi_definitions" ON kpi_definitions FOR SELECT USING (true);

-- Index for role filtering
CREATE INDEX idx_kpi_definitions_roles ON kpi_definitions USING GIN (applicable_roles);

-- Add reference column to agency kpis table
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS kpi_definition_id uuid REFERENCES kpi_definitions(id);
CREATE INDEX IF NOT EXISTS idx_kpis_definition ON kpis(kpi_definition_id);
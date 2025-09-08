-- Create KPI registry table with per-agency isolation
CREATE TABLE public.kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('number', 'currency', 'percentage', 'integer')),
  color TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, key)
);

-- Create KPI audit table for change tracking
CREATE TABLE public.kpi_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  kpi_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'deleted', 'restored', 'updated')),
  actor_id UUID NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NULL
);

-- Add form template columns for KPI health tracking
ALTER TABLE public.form_templates 
ADD COLUMN needs_attention BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN form_kpi_version INTEGER NOT NULL DEFAULT 1;

-- Enable RLS on new tables
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for kpis table
CREATE POLICY "Users can manage their agency KPIs" ON public.kpis
  FOR ALL USING (has_agency_access(auth.uid(), agency_id))
  WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Create RLS policies for kpi_audit table  
CREATE POLICY "Users can view their agency KPI audit" ON public.kpi_audit
  FOR SELECT USING (has_agency_access(auth.uid(), agency_id));

CREATE POLICY "Users can insert KPI audit for their agency" ON public.kpi_audit
  FOR INSERT WITH CHECK (has_agency_access(auth.uid(), agency_id));

-- Idempotent seeding: Insert existing KPI keys from scorecard_rules and form_templates
DO $$
DECLARE
  agency_rec RECORD;
  kpi_key TEXT;
  kpi_keys TEXT[];
BEGIN
  -- For each agency, collect all KPI keys from scorecard_rules and form_templates
  FOR agency_rec IN SELECT DISTINCT id as agency_id FROM public.agencies LOOP
    kpi_keys := ARRAY[]::TEXT[];
    
    -- Collect from scorecard_rules.selected_metrics
    SELECT array_agg(DISTINCT unnest_key) INTO kpi_keys
    FROM (
      SELECT unnest(selected_metrics) as unnest_key 
      FROM public.scorecard_rules 
      WHERE agency_id = agency_rec.agency_id
      UNION
      SELECT unnest(ring_metrics) as unnest_key
      FROM public.scorecard_rules 
      WHERE agency_id = agency_rec.agency_id AND ring_metrics IS NOT NULL
    ) combined_keys
    WHERE unnest_key IS NOT NULL;
    
    -- Default KPI keys if none found
    IF kpi_keys IS NULL OR array_length(kpi_keys, 1) IS NULL THEN
      kpi_keys := ARRAY['outbound_calls', 'talk_minutes', 'quoted_count', 'sold_items'];
    END IF;
    
    -- Insert each key with proper labels
    FOREACH kpi_key IN ARRAY kpi_keys LOOP
      INSERT INTO public.kpis (agency_id, key, label, type, is_active, created_at)
      VALUES (
        agency_rec.agency_id,
        kpi_key,
        CASE kpi_key
          WHEN 'outbound_calls' THEN 'Outbound Calls'
          WHEN 'talk_minutes' THEN 'Talk Minutes'
          WHEN 'quoted_count' THEN 'Quotes'
          WHEN 'sold_items' THEN 'Items Sold'
          WHEN 'sold_policies' THEN 'Policies Sold'
          WHEN 'sold_premium' THEN 'Premium Sold'
          WHEN 'cross_sells_uncovered' THEN 'Cross-Sells Uncovered'
          WHEN 'mini_reviews' THEN 'Mini Reviews'
          ELSE initcap(replace(kpi_key, '_', ' '))
        END,
        CASE kpi_key
          WHEN 'sold_premium' THEN 'currency'
          WHEN 'quoted_count' THEN 'number'
          WHEN 'outbound_calls' THEN 'number'
          WHEN 'talk_minutes' THEN 'number'
          WHEN 'sold_items' THEN 'number'
          WHEN 'sold_policies' THEN 'number'
          WHEN 'cross_sells_uncovered' THEN 'number'
          WHEN 'mini_reviews' THEN 'number'
          ELSE 'number'
        END,
        true,
        now()
      )
      ON CONFLICT (agency_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
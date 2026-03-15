-- Self-service onboarding: token table + provision function
-- Allows admin to generate onboarding links for new Boardroom clients

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =================================================================
-- 1. onboarding_tokens table
-- =================================================================
CREATE TABLE onboarding_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  email TEXT NOT NULL,
  agency_name TEXT,
  tier TEXT NOT NULL DEFAULT 'Boardroom',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'used', 'expired')),
  used_by_user_id UUID REFERENCES auth.users(id),
  used_by_agency_id UUID REFERENCES agencies(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

ALTER TABLE onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Admin read access (admin checks via has_role RPC, but RLS lets them SELECT)
CREATE POLICY "admins_read_onboarding_tokens"
  ON onboarding_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service-role handles all writes (edge functions)

-- =================================================================
-- 2. Add onboarding_completed_at to agencies
-- =================================================================
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- =================================================================
-- 3. provision_boardroom_defaults(p_agency_id) — called by edge function
-- =================================================================
CREATE OR REPLACE FUNCTION public.provision_boardroom_defaults(p_agency_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kpi_id uuid;
  v_kpi_version_id uuid;
  v_sales_form_id uuid;
  v_service_form_id uuid;
  v_agency_slug text;
  v_kpi_rec record;
BEGIN
  -- Get agency slug for form links
  SELECT slug INTO v_agency_slug FROM agencies WHERE id = p_agency_id;

  -- ---------------------------------------------------------------
  -- A. Insert standard KPIs + versions
  -- ---------------------------------------------------------------
  -- Shared KPIs (both roles)
  FOR v_kpi_rec IN
    SELECT * FROM (VALUES
      ('outbound_calls', 'Outbound Calls', 'number', NULL::app_member_role),
      ('talk_minutes', 'Talk Minutes', 'number', NULL)
    ) AS t(key, label, type, role)
  LOOP
    INSERT INTO kpis (agency_id, key, label, type, role, is_active)
    VALUES (p_agency_id, v_kpi_rec.key, v_kpi_rec.label, v_kpi_rec.type::text, v_kpi_rec.role, true)
    ON CONFLICT (agency_id, key) DO NOTHING
    RETURNING id INTO v_kpi_id;

    -- If inserted (not conflicted), create version
    IF v_kpi_id IS NOT NULL THEN
      INSERT INTO kpi_versions (kpi_id, label, valid_from)
      VALUES (v_kpi_id, v_kpi_rec.label, now());
    END IF;
    v_kpi_id := NULL;
  END LOOP;

  -- Sales KPIs
  FOR v_kpi_rec IN
    SELECT * FROM (VALUES
      ('quoted_households', 'Quoted Households', 'number', 'Sales'::app_member_role),
      ('items_quoted', 'Items Quoted', 'number', 'Sales'),
      ('items_sold', 'Items Sold', 'number', 'Sales'),
      ('policies_sold', 'Policies Sold', 'number', 'Sales'),
      ('premium_sold', 'Premium Sold', 'currency', 'Sales'),
      ('appointments_set', 'Appointments Set', 'number', 'Sales')
    ) AS t(key, label, type, role)
  LOOP
    INSERT INTO kpis (agency_id, key, label, type, role, is_active)
    VALUES (p_agency_id, v_kpi_rec.key, v_kpi_rec.label, v_kpi_rec.type::text, v_kpi_rec.role, true)
    ON CONFLICT (agency_id, key) DO NOTHING
    RETURNING id INTO v_kpi_id;

    IF v_kpi_id IS NOT NULL THEN
      INSERT INTO kpi_versions (kpi_id, label, valid_from)
      VALUES (v_kpi_id, v_kpi_rec.label, now());
    END IF;
    v_kpi_id := NULL;
  END LOOP;

  -- Service KPIs
  FOR v_kpi_rec IN
    SELECT * FROM (VALUES
      ('cross_sells_uncovered', 'Cross Sells Uncovered', 'number', 'Service'::app_member_role),
      ('mini_reviews', 'Mini Reviews', 'number', 'Service')
    ) AS t(key, label, type, role)
  LOOP
    INSERT INTO kpis (agency_id, key, label, type, role, is_active)
    VALUES (p_agency_id, v_kpi_rec.key, v_kpi_rec.label, v_kpi_rec.type::text, v_kpi_rec.role, true)
    ON CONFLICT (agency_id, key) DO NOTHING
    RETURNING id INTO v_kpi_id;

    IF v_kpi_id IS NOT NULL THEN
      INSERT INTO kpi_versions (kpi_id, label, valid_from)
      VALUES (v_kpi_id, v_kpi_rec.label, now());
    END IF;
    v_kpi_id := NULL;
  END LOOP;

  -- ---------------------------------------------------------------
  -- B. Scorecard rules (Sales + Service + Hybrid defaults)
  -- ---------------------------------------------------------------
  PERFORM create_default_scorecard_rules(p_agency_id);

  -- ---------------------------------------------------------------
  -- C. Form templates (Sales + Service)
  -- ---------------------------------------------------------------
  INSERT INTO form_templates (agency_id, name, slug, role, status, settings_json, schema_json)
  VALUES (
    p_agency_id,
    'Daily Scorecard - Sales',
    'daily-scorecard-sales',
    'Sales',
    'published',
    '{"lateCountsForPass": true, "sendDailySummary": true, "sendImmediateEmail": true}'::jsonb,
    jsonb_build_object(
      'kpis', (
        SELECT jsonb_agg(jsonb_build_object(
          'slug', k.key,
          'label', kv.label,
          'type', k.type,
          'kpi_version_id', kv.id
        ))
        FROM kpis k
        JOIN kpi_versions kv ON kv.kpi_id = k.id AND kv.valid_to IS NULL
        WHERE k.agency_id = p_agency_id AND k.is_active = true
          AND (k.role IS NULL OR k.role = 'Sales')
      )
    )
  )
  ON CONFLICT (agency_id, slug) DO NOTHING
  RETURNING id INTO v_sales_form_id;

  INSERT INTO form_templates (agency_id, name, slug, role, status, settings_json, schema_json)
  VALUES (
    p_agency_id,
    'Daily Scorecard - Service',
    'daily-scorecard-service',
    'Service',
    'published',
    '{"lateCountsForPass": true, "sendDailySummary": true, "sendImmediateEmail": true}'::jsonb,
    jsonb_build_object(
      'kpis', (
        SELECT jsonb_agg(jsonb_build_object(
          'slug', k.key,
          'label', kv.label,
          'type', k.type,
          'kpi_version_id', kv.id
        ))
        FROM kpis k
        JOIN kpi_versions kv ON kv.kpi_id = k.id AND kv.valid_to IS NULL
        WHERE k.agency_id = p_agency_id AND k.is_active = true
          AND (k.role IS NULL OR k.role = 'Service')
      )
    )
  )
  ON CONFLICT (agency_id, slug) DO NOTHING
  RETURNING id INTO v_service_form_id;

  -- ---------------------------------------------------------------
  -- D. Form links (public tokens for each template)
  -- ---------------------------------------------------------------
  IF v_sales_form_id IS NOT NULL THEN
    INSERT INTO form_links (form_template_id, token)
    VALUES (v_sales_form_id, encode(extensions.gen_random_bytes(16), 'hex'))
    ON CONFLICT DO NOTHING;

    -- Bind KPI versions to sales form
    INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
    SELECT v_sales_form_id, kv.id
    FROM kpis k
    JOIN kpi_versions kv ON kv.kpi_id = k.id AND kv.valid_to IS NULL
    WHERE k.agency_id = p_agency_id AND k.is_active = true
      AND (k.role IS NULL OR k.role = 'Sales')
    ON CONFLICT (form_template_id, kpi_version_id) DO NOTHING;
  END IF;

  IF v_service_form_id IS NOT NULL THEN
    INSERT INTO form_links (form_template_id, token)
    VALUES (v_service_form_id, encode(extensions.gen_random_bytes(16), 'hex'))
    ON CONFLICT DO NOTHING;

    -- Bind KPI versions to service form
    INSERT INTO forms_kpi_bindings (form_template_id, kpi_version_id)
    SELECT v_service_form_id, kv.id
    FROM kpis k
    JOIN kpi_versions kv ON kv.kpi_id = k.id AND kv.valid_to IS NULL
    WHERE k.agency_id = p_agency_id AND k.is_active = true
      AND (k.role IS NULL OR k.role = 'Service')
    ON CONFLICT (form_template_id, kpi_version_id) DO NOTHING;
  END IF;
END;
$$;

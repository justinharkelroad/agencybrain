-- GATE 4: Create test metrics_daily record with V3 KPI label to show label_at_submit.
-- This simulates a form submission today with the updated KPI binding.
DO $$
DECLARE
  v_agency_id uuid;
  v_member_id uuid;
  v_kpi_version_id uuid;
BEGIN
  SELECT id INTO v_agency_id
  FROM agencies
  WHERE slug = 'hfi-inc'
  LIMIT 1;

  SELECT id INTO v_member_id
  FROM team_members
  WHERE id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316';

  SELECT kv.id INTO v_kpi_version_id
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.label = 'Quoted Prospects'
    AND kv.valid_to IS NULL
    AND kv.label = 'Prospect Quotes V3'
  ORDER BY kv.valid_from DESC
  LIMIT 1;

  IF v_agency_id IS NULL OR v_member_id IS NULL OR v_kpi_version_id IS NULL THEN
    RAISE NOTICE 'Skipping gate metrics seed: missing dependencies (agency %, member %, kpi_version %).',
      v_agency_id, v_member_id, v_kpi_version_id;
    RETURN;
  END IF;

  INSERT INTO metrics_daily (
    agency_id,
    team_member_id,
    date,
    role,
    kpi_version_id,
    label_at_submit,
    outbound_calls,
    talk_minutes,
    quoted_count,
    sold_items,
    pass,
    hits,
    daily_score,
    streak_count
  ) VALUES (
    v_agency_id,
    v_member_id,
    CURRENT_DATE,
    'Sales',
    v_kpi_version_id,
    'Prospect Quotes V3',
    25,
    120,
    3,
    1,
    true,
    3,
    85,
    2
  )
  ON CONFLICT (team_member_id, date)
  DO UPDATE SET
    kpi_version_id = EXCLUDED.kpi_version_id,
    label_at_submit = EXCLUDED.label_at_submit,
    outbound_calls = EXCLUDED.outbound_calls,
    talk_minutes = EXCLUDED.talk_minutes,
    quoted_count = EXCLUDED.quoted_count,
    sold_items = EXCLUDED.sold_items,
    pass = EXCLUDED.pass,
    hits = EXCLUDED.hits,
    daily_score = EXCLUDED.daily_score,
    streak_count = EXCLUDED.streak_count;
END $$;

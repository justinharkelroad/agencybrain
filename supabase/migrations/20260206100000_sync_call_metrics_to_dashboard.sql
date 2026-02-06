-- Sync call_metrics_daily → metrics_daily so the dashboard
-- automatically surfaces RingCentral phone data (outbound_calls, talk_minutes).

-- Part 1: Trigger function
CREATE OR REPLACE FUNCTION sync_call_metrics_to_metrics_daily()
RETURNS TRIGGER AS $$
DECLARE
  v_role app_member_role;
  v_kpi_version_id uuid;
  v_label text;
BEGIN
  -- metrics_daily.team_member_id is NOT NULL; skip unmatched rows
  IF NEW.team_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM team_members WHERE id = NEW.team_member_id;

  -- Lookup kpi_version for CHECK constraint (required for new rows)
  SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
  FROM kpi_versions kv
  JOIN kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = NEW.agency_id AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC LIMIT 1;

  -- Fallback via form bindings
  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
    FROM forms_kpi_bindings fb
    JOIN kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = NEW.agency_id AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC LIMIT 1;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RAISE LOG 'sync_call_metrics: No kpi_version for agency=%, skipping', NEW.agency_id;
    RETURN NEW;
  END IF;

  INSERT INTO metrics_daily (
    agency_id, team_member_id, date, role,
    outbound_calls, talk_minutes,
    kpi_version_id, label_at_submit
  )
  VALUES (
    NEW.agency_id,
    NEW.team_member_id,
    NEW.date,
    COALESCE(v_role, 'Sales'),
    NEW.outbound_calls,
    ROUND(NEW.total_talk_seconds / 60.0)::int,
    v_kpi_version_id, v_label
  )
  ON CONFLICT (team_member_id, date) DO UPDATE SET
    outbound_calls = EXCLUDED.outbound_calls,
    talk_minutes   = EXCLUDED.talk_minutes,
    updated_at     = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_sync_call_metrics
  AFTER INSERT OR UPDATE ON call_metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION sync_call_metrics_to_metrics_daily();

-- Part 2: Backfill existing data (only updates existing metrics_daily rows;
-- INSERT path requires kpi_version_id which varies per agency, so new rows
-- are skipped here and will be created when the next scorecard is submitted)
UPDATE metrics_daily md
SET
  outbound_calls = cmd.outbound_calls,
  talk_minutes   = ROUND(cmd.total_talk_seconds / 60.0)::int,
  updated_at     = now()
FROM call_metrics_daily cmd
WHERE cmd.team_member_id = md.team_member_id
  AND cmd.date = md.date
  AND (cmd.outbound_calls > 0 OR cmd.total_talk_seconds > 0);

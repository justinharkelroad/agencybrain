-- Keep legacy call_metrics_daily -> metrics_daily sync aligned to explicit mode.
-- Only mode='on' should write call values into metrics_daily.

CREATE OR REPLACE FUNCTION public.sync_call_metrics_to_metrics_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_member_role;
  v_kpi_version_id uuid;
  v_label text;
  v_mode text;
BEGIN
  -- metrics_daily.team_member_id is NOT NULL; skip unmatched rows
  IF NEW.team_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    a.call_metrics_mode,
    CASE WHEN COALESCE(a.dashboard_call_metrics_enabled, false) THEN 'shadow' ELSE 'off' END,
    'off'
  )
  INTO v_mode
  FROM public.agencies a
  WHERE a.id = NEW.agency_id;

  -- In off/shadow modes, do not sync call metrics into manual scorecard storage.
  IF v_mode <> 'on' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role FROM public.team_members WHERE id = NEW.team_member_id;

  -- Lookup kpi_version for CHECK constraint (required for new rows)
  SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
  FROM public.kpi_versions kv
  JOIN public.kpis k ON k.id = kv.kpi_id
  WHERE k.agency_id = NEW.agency_id
    AND kv.valid_to IS NULL
  ORDER BY kv.valid_from DESC
  LIMIT 1;

  -- Fallback via form bindings
  IF v_kpi_version_id IS NULL THEN
    SELECT kv.id, kv.label INTO v_kpi_version_id, v_label
    FROM public.forms_kpi_bindings fb
    JOIN public.kpi_versions kv ON kv.id = fb.kpi_version_id
    JOIN public.form_templates ft ON ft.id = fb.form_template_id
    WHERE ft.agency_id = NEW.agency_id
      AND kv.valid_to IS NULL
    ORDER BY fb.created_at DESC
    LIMIT 1;
  END IF;

  IF v_kpi_version_id IS NULL THEN
    RAISE LOG 'sync_call_metrics: No kpi_version for agency=%, skipping', NEW.agency_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.metrics_daily (
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
$function$;

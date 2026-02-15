-- Phase 1: Automated Metrics Foundation
-- Adds:
-- 1) Agency-level call metrics mode (off/shadow/on)
-- 2) Normalized daily facts table (manual + auto values)
-- 3) Snapshot scaffolding tables/functions for daily lock pipeline

-- -----------------------------------------------------------------------------
-- 1) Agency choice mode
-- -----------------------------------------------------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS call_metrics_mode text;

ALTER TABLE public.agencies
  ALTER COLUMN call_metrics_mode SET DEFAULT 'off';

UPDATE public.agencies
SET call_metrics_mode = CASE
  WHEN COALESCE(dashboard_call_metrics_enabled, false) THEN 'shadow'
  ELSE 'off'
END
WHERE call_metrics_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agencies_call_metrics_mode_check'
  ) THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_call_metrics_mode_check
      CHECK (call_metrics_mode IN ('off', 'shadow', 'on'));
  END IF;
END $$;

ALTER TABLE public.agencies
  ALTER COLUMN call_metrics_mode SET NOT NULL;

COMMENT ON COLUMN public.agencies.call_metrics_mode IS
'Controls call metric automation behavior: off=manual only, shadow=auto calculated but not canonical, on=auto can feed canonical metrics.';

CREATE OR REPLACE FUNCTION public.sync_agency_call_metrics_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Keep legacy dashboard toggle and new mode in sync during transition.
  IF TG_OP = 'INSERT' THEN
    IF NEW.call_metrics_mode IS NULL THEN
      NEW.call_metrics_mode := CASE
        WHEN COALESCE(NEW.dashboard_call_metrics_enabled, false) THEN 'shadow'
        ELSE 'off'
      END;
    END IF;
    NEW.dashboard_call_metrics_enabled := (NEW.call_metrics_mode <> 'off');
    RETURN NEW;
  END IF;

  IF NEW.call_metrics_mode IS DISTINCT FROM OLD.call_metrics_mode THEN
    NEW.dashboard_call_metrics_enabled := (NEW.call_metrics_mode <> 'off');
    RETURN NEW;
  END IF;

  IF NEW.dashboard_call_metrics_enabled IS DISTINCT FROM OLD.dashboard_call_metrics_enabled THEN
    NEW.call_metrics_mode := CASE
      WHEN COALESCE(NEW.dashboard_call_metrics_enabled, false) THEN 'shadow'
      ELSE 'off'
    END;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_agency_call_metrics_mode ON public.agencies;
CREATE TRIGGER trg_sync_agency_call_metrics_mode
  BEFORE INSERT OR UPDATE OF dashboard_call_metrics_enabled, call_metrics_mode ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_agency_call_metrics_mode();

-- -----------------------------------------------------------------------------
-- 2) Normalized daily facts (one row per user/day)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metrics_daily_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  date date NOT NULL,
  role app_member_role,

  call_metrics_mode text NOT NULL DEFAULT 'off' CHECK (call_metrics_mode IN ('off', 'shadow', 'on')),

  -- Manual values (existing scorecard/dashboard canonical values)
  outbound_calls_manual integer NOT NULL DEFAULT 0,
  talk_minutes_manual integer NOT NULL DEFAULT 0,

  -- Auto values (VOIP ingest)
  outbound_calls_auto integer NOT NULL DEFAULT 0,
  inbound_calls_auto integer NOT NULL DEFAULT 0,
  total_calls_auto integer NOT NULL DEFAULT 0,
  talk_minutes_auto integer NOT NULL DEFAULT 0,

  -- Other daily core metrics
  quoted_households integer NOT NULL DEFAULT 0,
  items_sold integer NOT NULL DEFAULT 0,

  call_data_status text NOT NULL DEFAULT 'missing' CHECK (call_data_status IN ('ok', 'partial', 'missing', 'disabled')),
  source_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_recomputed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_metrics_daily_facts_member_date UNIQUE (agency_id, team_member_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_facts_agency_date
  ON public.metrics_daily_facts(agency_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_facts_member_date
  ON public.metrics_daily_facts(team_member_id, date DESC);

ALTER TABLE public.metrics_daily_facts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'metrics_daily_facts'
      AND policyname = 'Agency members view metrics_daily_facts'
  ) THEN
    CREATE POLICY "Agency members view metrics_daily_facts"
      ON public.metrics_daily_facts FOR SELECT
      USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Recompute helpers (trigger-safe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_metrics_daily_fact(
  p_agency_id uuid,
  p_team_member_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_call_mode text := 'off';
  v_md_exists boolean := false;
  v_md_role app_member_role;
  v_md_outbound_calls integer := 0;
  v_md_talk_minutes integer := 0;
  v_md_quoted_count integer := 0;
  v_md_sold_items integer := 0;
  v_cmd_exists boolean := false;
  v_cmd_outbound_calls integer := 0;
  v_cmd_inbound_calls integer := 0;
  v_cmd_total_calls integer := 0;
  v_cmd_total_talk_seconds integer := 0;
  v_role app_member_role;
  v_call_status text := 'missing';
BEGIN
  SELECT
    COALESCE(
      a.call_metrics_mode,
      CASE WHEN COALESCE(a.dashboard_call_metrics_enabled, false) THEN 'shadow' ELSE 'off' END,
      'off'
    )
  INTO v_call_mode
  FROM public.agencies a
  WHERE a.id = p_agency_id;

  SELECT true, md.role, COALESCE(md.outbound_calls, 0), COALESCE(md.talk_minutes, 0), COALESCE(md.quoted_count, 0), COALESCE(md.sold_items, 0)
  INTO v_md_exists, v_md_role, v_md_outbound_calls, v_md_talk_minutes, v_md_quoted_count, v_md_sold_items
  FROM public.metrics_daily md
  WHERE md.agency_id = p_agency_id
    AND md.team_member_id = p_team_member_id
    AND md.date = p_date;

  IF NOT FOUND THEN
    v_md_exists := false;
    v_md_role := NULL;
    v_md_outbound_calls := 0;
    v_md_talk_minutes := 0;
    v_md_quoted_count := 0;
    v_md_sold_items := 0;
  END IF;

  SELECT true, COALESCE(cmd.outbound_calls, 0), COALESCE(cmd.inbound_calls, 0), COALESCE(cmd.total_calls, 0), COALESCE(cmd.total_talk_seconds, 0)
  INTO v_cmd_exists, v_cmd_outbound_calls, v_cmd_inbound_calls, v_cmd_total_calls, v_cmd_total_talk_seconds
  FROM public.call_metrics_daily cmd
  WHERE cmd.agency_id = p_agency_id
    AND cmd.team_member_id = p_team_member_id
    AND cmd.date = p_date;

  IF NOT FOUND THEN
    v_cmd_exists := false;
    v_cmd_outbound_calls := 0;
    v_cmd_inbound_calls := 0;
    v_cmd_total_calls := 0;
    v_cmd_total_talk_seconds := 0;
  END IF;

  -- If neither source has data anymore, remove stale fact row.
  IF NOT v_md_exists AND NOT v_cmd_exists THEN
    DELETE FROM public.metrics_daily_facts
    WHERE agency_id = p_agency_id
      AND team_member_id = p_team_member_id
      AND date = p_date;
    RETURN;
  END IF;

  v_role := COALESCE(v_md_role, (SELECT role FROM public.team_members WHERE id = p_team_member_id), 'Sales');

  IF v_call_mode = 'off' THEN
    v_call_status := 'disabled';
  ELSIF NOT v_cmd_exists THEN
    v_call_status := 'missing';
  ELSE
    v_call_status := 'ok';
  END IF;

  INSERT INTO public.metrics_daily_facts (
    agency_id,
    team_member_id,
    date,
    role,
    call_metrics_mode,
    outbound_calls_manual,
    talk_minutes_manual,
    outbound_calls_auto,
    inbound_calls_auto,
    total_calls_auto,
    talk_minutes_auto,
    quoted_households,
    items_sold,
    call_data_status,
    source_flags,
    last_recomputed_at,
    updated_at
  )
  VALUES (
    p_agency_id,
    p_team_member_id,
    p_date,
    v_role,
    v_call_mode,
    v_md_outbound_calls,
    v_md_talk_minutes,
    v_cmd_outbound_calls,
    v_cmd_inbound_calls,
    v_cmd_total_calls,
    ROUND(v_cmd_total_talk_seconds / 60.0)::int,
    v_md_quoted_count,
    v_md_sold_items,
    v_call_status,
    jsonb_build_object(
      'has_metrics_daily', v_md_exists,
      'has_call_metrics_daily', v_cmd_exists
    ),
    now(),
    now()
  )
  ON CONFLICT (agency_id, team_member_id, date)
  DO UPDATE SET
    role = EXCLUDED.role,
    call_metrics_mode = EXCLUDED.call_metrics_mode,
    outbound_calls_manual = EXCLUDED.outbound_calls_manual,
    talk_minutes_manual = EXCLUDED.talk_minutes_manual,
    outbound_calls_auto = EXCLUDED.outbound_calls_auto,
    inbound_calls_auto = EXCLUDED.inbound_calls_auto,
    total_calls_auto = EXCLUDED.total_calls_auto,
    talk_minutes_auto = EXCLUDED.talk_minutes_auto,
    quoted_households = EXCLUDED.quoted_households,
    items_sold = EXCLUDED.items_sold,
    call_data_status = EXCLUDED.call_data_status,
    source_flags = EXCLUDED.source_flags,
    last_recomputed_at = EXCLUDED.last_recomputed_at,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recompute_metrics_fact_from_metrics_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_metrics_daily_fact(OLD.agency_id, OLD.team_member_id, OLD.date);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_metrics_daily_fact(NEW.agency_id, NEW.team_member_id, NEW.date);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recompute_metrics_fact_on_metrics_daily ON public.metrics_daily;
CREATE TRIGGER trg_recompute_metrics_fact_on_metrics_daily
  AFTER INSERT OR UPDATE OR DELETE ON public.metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_metrics_fact_from_metrics_daily();

CREATE OR REPLACE FUNCTION public.trg_recompute_metrics_fact_from_call_metrics_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.team_member_id IS NOT NULL THEN
      PERFORM public.recompute_metrics_daily_fact(OLD.agency_id, OLD.team_member_id, OLD.date);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.team_member_id IS NOT NULL THEN
    PERFORM public.recompute_metrics_daily_fact(NEW.agency_id, NEW.team_member_id, NEW.date);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recompute_metrics_fact_on_call_metrics_daily ON public.call_metrics_daily;
CREATE TRIGGER trg_recompute_metrics_fact_on_call_metrics_daily
  AFTER INSERT OR UPDATE OR DELETE ON public.call_metrics_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_metrics_fact_from_call_metrics_daily();

CREATE OR REPLACE FUNCTION public.refresh_metrics_daily_facts(
  p_agency_id uuid DEFAULT NULL,
  p_start_date date DEFAULT (current_date - 45),
  p_end_date date DEFAULT current_date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  WITH keys AS (
    SELECT md.agency_id, md.team_member_id, md.date
    FROM public.metrics_daily md
    WHERE md.date BETWEEN p_start_date AND p_end_date
      AND (p_agency_id IS NULL OR md.agency_id = p_agency_id)

    UNION

    SELECT cmd.agency_id, cmd.team_member_id, cmd.date
    FROM public.call_metrics_daily cmd
    WHERE cmd.team_member_id IS NOT NULL
      AND cmd.date BETWEEN p_start_date AND p_end_date
      AND (p_agency_id IS NULL OR cmd.agency_id = p_agency_id)
  ),
  upserted AS (
    INSERT INTO public.metrics_daily_facts (
      agency_id,
      team_member_id,
      date,
      role,
      call_metrics_mode,
      outbound_calls_manual,
      talk_minutes_manual,
      outbound_calls_auto,
      inbound_calls_auto,
      total_calls_auto,
      talk_minutes_auto,
      quoted_households,
      items_sold,
      call_data_status,
      source_flags,
      last_recomputed_at,
      updated_at
    )
    SELECT
      k.agency_id,
      k.team_member_id,
      k.date,
      COALESCE(md.role, tm.role, 'Sales') AS role,
      COALESCE(
        a.call_metrics_mode,
        CASE WHEN COALESCE(a.dashboard_call_metrics_enabled, false) THEN 'shadow' ELSE 'off' END,
        'off'
      ) AS call_metrics_mode,
      COALESCE(md.outbound_calls, 0) AS outbound_calls_manual,
      COALESCE(md.talk_minutes, 0) AS talk_minutes_manual,
      COALESCE(cmd.outbound_calls, 0) AS outbound_calls_auto,
      COALESCE(cmd.inbound_calls, 0) AS inbound_calls_auto,
      COALESCE(cmd.total_calls, 0) AS total_calls_auto,
      ROUND(COALESCE(cmd.total_talk_seconds, 0) / 60.0)::int AS talk_minutes_auto,
      COALESCE(md.quoted_count, 0) AS quoted_households,
      COALESCE(md.sold_items, 0) AS items_sold,
      CASE
        WHEN COALESCE(
          a.call_metrics_mode,
          CASE WHEN COALESCE(a.dashboard_call_metrics_enabled, false) THEN 'shadow' ELSE 'off' END,
          'off'
        ) = 'off' THEN 'disabled'
        WHEN cmd.team_member_id IS NULL THEN 'missing'
        ELSE 'ok'
      END AS call_data_status,
      jsonb_build_object(
        'has_metrics_daily', (md.team_member_id IS NOT NULL),
        'has_call_metrics_daily', (cmd.team_member_id IS NOT NULL)
      ) AS source_flags,
      now(),
      now()
    FROM keys k
    JOIN public.agencies a ON a.id = k.agency_id
    LEFT JOIN public.metrics_daily md
      ON md.agency_id = k.agency_id
     AND md.team_member_id = k.team_member_id
     AND md.date = k.date
    LEFT JOIN public.call_metrics_daily cmd
      ON cmd.agency_id = k.agency_id
     AND cmd.team_member_id = k.team_member_id
     AND cmd.date = k.date
    LEFT JOIN public.team_members tm
      ON tm.id = k.team_member_id
    ON CONFLICT (agency_id, team_member_id, date)
    DO UPDATE SET
      role = EXCLUDED.role,
      call_metrics_mode = EXCLUDED.call_metrics_mode,
      outbound_calls_manual = EXCLUDED.outbound_calls_manual,
      talk_minutes_manual = EXCLUDED.talk_minutes_manual,
      outbound_calls_auto = EXCLUDED.outbound_calls_auto,
      inbound_calls_auto = EXCLUDED.inbound_calls_auto,
      total_calls_auto = EXCLUDED.total_calls_auto,
      talk_minutes_auto = EXCLUDED.talk_minutes_auto,
      quoted_households = EXCLUDED.quoted_households,
      items_sold = EXCLUDED.items_sold,
      call_data_status = EXCLUDED.call_data_status,
      source_flags = EXCLUDED.source_flags,
      last_recomputed_at = EXCLUDED.last_recomputed_at,
      updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_metrics_facts_for_agency_mode_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_mode text;
BEGIN
  v_mode := COALESCE(
    NEW.call_metrics_mode,
    CASE WHEN COALESCE(NEW.dashboard_call_metrics_enabled, false) THEN 'shadow' ELSE 'off' END,
    'off'
  );

  UPDATE public.metrics_daily_facts f
  SET
    call_metrics_mode = v_mode,
    call_data_status = CASE
      WHEN v_mode = 'off' THEN 'disabled'
      WHEN COALESCE((f.source_flags ->> 'has_call_metrics_daily')::boolean, false) THEN 'ok'
      ELSE 'missing'
    END,
    last_recomputed_at = now(),
    updated_at = now()
  WHERE f.agency_id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_refresh_metrics_facts_on_agency_mode_change ON public.agencies;
CREATE TRIGGER trg_refresh_metrics_facts_on_agency_mode_change
  AFTER UPDATE OF dashboard_call_metrics_enabled, call_metrics_mode ON public.agencies
  FOR EACH ROW
  WHEN (
    OLD.dashboard_call_metrics_enabled IS DISTINCT FROM NEW.dashboard_call_metrics_enabled
    OR OLD.call_metrics_mode IS DISTINCT FROM NEW.call_metrics_mode
  )
  EXECUTE FUNCTION public.refresh_metrics_facts_for_agency_mode_change();

-- Initial backfill for recent history.
SELECT public.refresh_metrics_daily_facts(NULL, current_date - 45, current_date);

-- -----------------------------------------------------------------------------
-- 4) Daily snapshot scaffolding
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metrics_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  lock_type text NOT NULL DEFAULT 'hard_lock' CHECK (lock_type IN ('soft_close', 'hard_lock', 'manual')),
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('pending', 'locked', 'superseded')),
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_metrics_snapshot_version UNIQUE (agency_id, snapshot_date, version)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_snapshots_agency_date
  ON public.metrics_daily_snapshots(agency_id, snapshot_date DESC, version DESC);

CREATE TABLE IF NOT EXISTS public.metrics_daily_snapshot_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.metrics_daily_snapshots(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role app_member_role,

  metric_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attainment_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_snapshot_member UNIQUE (snapshot_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_snapshot_rows_snapshot
  ON public.metrics_daily_snapshot_rows(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_snapshot_rows_agency_member
  ON public.metrics_daily_snapshot_rows(agency_id, team_member_id);

ALTER TABLE public.metrics_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily_snapshot_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'metrics_daily_snapshots'
      AND policyname = 'Agency members view metrics_daily_snapshots'
  ) THEN
    CREATE POLICY "Agency members view metrics_daily_snapshots"
      ON public.metrics_daily_snapshots FOR SELECT
      USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'metrics_daily_snapshot_rows'
      AND policyname = 'Agency members view metrics_daily_snapshot_rows'
  ) THEN
    CREATE POLICY "Agency members view metrics_daily_snapshot_rows"
      ON public.metrics_daily_snapshot_rows FOR SELECT
      USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_metrics_daily_snapshot(
  p_agency_id uuid,
  p_snapshot_date date,
  p_lock_type text DEFAULT 'hard_lock',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot_id uuid;
  v_version integer;
BEGIN
  IF p_lock_type NOT IN ('soft_close', 'hard_lock', 'manual') THEN
    RAISE EXCEPTION 'Invalid lock type: %', p_lock_type;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_version
  FROM public.metrics_daily_snapshots
  WHERE agency_id = p_agency_id
    AND snapshot_date = p_snapshot_date;

  INSERT INTO public.metrics_daily_snapshots (
    agency_id,
    snapshot_date,
    lock_type,
    status,
    version,
    created_by
  )
  VALUES (
    p_agency_id,
    p_snapshot_date,
    p_lock_type,
    'locked',
    v_version,
    p_created_by
  )
  RETURNING id INTO v_snapshot_id;

  INSERT INTO public.metrics_daily_snapshot_rows (
    snapshot_id,
    agency_id,
    team_member_id,
    role,
    metric_payload,
    target_payload,
    attainment_payload,
    source_payload,
    status_payload
  )
  SELECT
    v_snapshot_id,
    f.agency_id,
    f.team_member_id,
    COALESCE(f.role, tm.role, 'Sales') AS role,
    jsonb_build_object(
      'outbound_calls', CASE WHEN f.call_metrics_mode = 'on' THEN GREATEST(f.outbound_calls_auto, f.outbound_calls_manual) ELSE f.outbound_calls_manual END,
      'inbound_calls', f.inbound_calls_auto,
      'total_calls', f.total_calls_auto,
      'talk_minutes', CASE WHEN f.call_metrics_mode = 'on' THEN GREATEST(f.talk_minutes_auto, f.talk_minutes_manual) ELSE f.talk_minutes_manual END,
      'quoted_households', f.quoted_households,
      'items_sold', f.items_sold
    ) AS metric_payload,
    jsonb_build_object(
      'outbound_calls', public.get_target(f.agency_id, f.team_member_id, 'outbound_calls'),
      'talk_minutes', public.get_target(f.agency_id, f.team_member_id, 'talk_minutes'),
      'quoted_households', COALESCE(
        NULLIF(public.get_target(f.agency_id, f.team_member_id, 'quoted_households'), 0),
        public.get_target(f.agency_id, f.team_member_id, 'quoted_count')
      ),
      'items_sold', COALESCE(
        NULLIF(public.get_target(f.agency_id, f.team_member_id, 'items_sold'), 0),
        public.get_target(f.agency_id, f.team_member_id, 'sold_items')
      )
    ) AS target_payload,
    jsonb_build_object(
      'outbound_calls', CASE
        WHEN public.get_target(f.agency_id, f.team_member_id, 'outbound_calls') > 0
          THEN ROUND(
            (
              (CASE WHEN f.call_metrics_mode = 'on' THEN GREATEST(f.outbound_calls_auto, f.outbound_calls_manual) ELSE f.outbound_calls_manual END)::numeric
              / public.get_target(f.agency_id, f.team_member_id, 'outbound_calls')
            ) * 100,
            2
          )
        ELSE NULL
      END,
      'talk_minutes', CASE
        WHEN public.get_target(f.agency_id, f.team_member_id, 'talk_minutes') > 0
          THEN ROUND(
            (
              (CASE WHEN f.call_metrics_mode = 'on' THEN GREATEST(f.talk_minutes_auto, f.talk_minutes_manual) ELSE f.talk_minutes_manual END)::numeric
              / public.get_target(f.agency_id, f.team_member_id, 'talk_minutes')
            ) * 100,
            2
          )
        ELSE NULL
      END,
      'quoted_households', CASE
        WHEN COALESCE(NULLIF(public.get_target(f.agency_id, f.team_member_id, 'quoted_households'), 0), public.get_target(f.agency_id, f.team_member_id, 'quoted_count')) > 0
          THEN ROUND(
            (f.quoted_households::numeric /
              COALESCE(NULLIF(public.get_target(f.agency_id, f.team_member_id, 'quoted_households'), 0), public.get_target(f.agency_id, f.team_member_id, 'quoted_count'))
            ) * 100,
            2
          )
        ELSE NULL
      END,
      'items_sold', CASE
        WHEN COALESCE(NULLIF(public.get_target(f.agency_id, f.team_member_id, 'items_sold'), 0), public.get_target(f.agency_id, f.team_member_id, 'sold_items')) > 0
          THEN ROUND(
            (f.items_sold::numeric /
              COALESCE(NULLIF(public.get_target(f.agency_id, f.team_member_id, 'items_sold'), 0), public.get_target(f.agency_id, f.team_member_id, 'sold_items'))
            ) * 100,
            2
          )
        ELSE NULL
      END
    ) AS attainment_payload,
    jsonb_build_object(
      'call_metrics_mode', f.call_metrics_mode,
      'outbound_calls_manual', f.outbound_calls_manual,
      'talk_minutes_manual', f.talk_minutes_manual,
      'outbound_calls_auto', f.outbound_calls_auto,
      'inbound_calls_auto', f.inbound_calls_auto,
      'total_calls_auto', f.total_calls_auto,
      'talk_minutes_auto', f.talk_minutes_auto,
      'source_flags', f.source_flags
    ) AS source_payload,
    jsonb_build_object(
      'call_data_status', f.call_data_status
    ) AS status_payload
  FROM public.metrics_daily_facts f
  LEFT JOIN public.team_members tm ON tm.id = f.team_member_id
  WHERE f.agency_id = p_agency_id
    AND f.date = p_snapshot_date;

  RETURN v_snapshot_id;
END;
$function$;

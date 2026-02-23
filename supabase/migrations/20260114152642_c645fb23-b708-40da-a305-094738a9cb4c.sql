-- Fix historical call scores where overall_score = 0 but skill_scores exist
-- Recalculates overall_score as average of skill_scores * 10 (to convert 0-10 scale to 0-100)

DO $$
DECLARE
  v_has_analyzed_at boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agency_calls'
      AND column_name = 'analyzed_at'
  );
  v_has_analyzed_or_created_at boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agency_calls'
      AND column_name = 'analyzed_or_created_at'
  );
BEGIN
  IF to_regclass('public.agency_calls') IS NULL THEN
    RAISE NOTICE 'Skipping call score backfill; public.agency_calls does not exist.';
    RETURN;
  END IF;

  IF NOT (v_has_analyzed_at OR v_has_analyzed_or_created_at) THEN
    RAISE NOTICE 'Skipping call score backfill; no analyzed timestamp column found on public.agency_calls.';
    UPDATE agency_calls
    SET overall_score = (
      SELECT ROUND(AVG((skill->>'score')::numeric) * 10)
      FROM jsonb_array_elements(skill_scores::jsonb) AS skill
      WHERE skill->>'score' IS NOT NULL
    )
    WHERE overall_score = 0
      AND skill_scores IS NOT NULL
      AND jsonb_array_length(skill_scores::jsonb) > 0;
    RETURN;
  END IF;

  IF v_has_analyzed_at THEN
    UPDATE agency_calls
    SET overall_score = (
      SELECT ROUND(AVG((skill->>'score')::numeric) * 10)
      FROM jsonb_array_elements(skill_scores::jsonb) AS skill
      WHERE skill->>'score' IS NOT NULL
    )
    WHERE overall_score = 0
      AND skill_scores IS NOT NULL
      AND jsonb_array_length(skill_scores::jsonb) > 0
      AND analyzed_at IS NOT NULL;
  ELSIF v_has_analyzed_or_created_at THEN
    UPDATE agency_calls
    SET overall_score = (
      SELECT ROUND(AVG((skill->>'score')::numeric) * 10)
      FROM jsonb_array_elements(skill_scores::jsonb) AS skill
      WHERE skill->>'score' IS NOT NULL
    )
    WHERE overall_score = 0
      AND skill_scores IS NOT NULL
      AND jsonb_array_length(skill_scores::jsonb) > 0
      AND analyzed_or_created_at IS NOT NULL;
  END IF;
END $$;

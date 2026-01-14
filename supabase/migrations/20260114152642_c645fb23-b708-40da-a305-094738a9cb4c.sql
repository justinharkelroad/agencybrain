-- Fix historical call scores where overall_score = 0 but skill_scores exist
-- Recalculates overall_score as average of skill_scores * 10 (to convert 0-10 scale to 0-100)

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
-- Remove POTENTIAL RANK CRITERIA section from system_prompt
-- This section appears between "POTENTIAL RANK CRITERIA:" and the next section header

UPDATE call_scoring_templates
SET system_prompt = regexp_replace(
  system_prompt,
  'POTENTIAL RANK CRITERIA:.*?(?=(DISCOVERY WINS|CLOSING ATTEMPTS|COACHING FOCUS|CHECKLIST|OUTPUT FORMAT|CRM NOTES|$))',
  '',
  'ins'
)
WHERE system_prompt ILIKE '%POTENTIAL RANK CRITERIA%';

-- Remove potential_rank line from JSON OUTPUT FORMAT
UPDATE call_scoring_templates
SET system_prompt = regexp_replace(
  system_prompt,
  '"potential_rank"[^,\n]*,?\s*\n?',
  '',
  'g'
)
WHERE system_prompt ILIKE '%"potential_rank"%';

-- Remove potential_rank_rationale line from JSON OUTPUT FORMAT
UPDATE call_scoring_templates
SET system_prompt = regexp_replace(
  system_prompt,
  '"potential_rank_rationale"[^,\n]*,?\s*\n?',
  '',
  'g'
)
WHERE system_prompt ILIKE '%"potential_rank_rationale"%';
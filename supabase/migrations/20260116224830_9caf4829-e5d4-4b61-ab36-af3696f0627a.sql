-- Re-activate the talk_minutes KPI that was accidentally deleted
-- This fixes Jason Smith's immediate issue
UPDATE kpis 
SET is_active = true, effective_to = NULL
WHERE id = '64a8738a-64ec-4ab5-9272-f0da18d9a48f';

-- Also clear needs_attention on any forms that might be flagged due to this
-- (they'll be re-flagged if there are other issues)
UPDATE form_templates
SET needs_attention = false
WHERE needs_attention = true
AND agency_id = (SELECT agency_id FROM kpis WHERE id = '64a8738a-64ec-4ab5-9272-f0da18d9a48f');
-- Clear existing final submission for the test date and finalize our test submission
UPDATE submissions 
SET final = false 
WHERE form_template_id = (SELECT id FROM form_templates WHERE slug = 'sales-scorecard-new' AND agency_id = (SELECT id FROM agencies WHERE slug = 'hfi-inc'))
  AND team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316'
  AND COALESCE(work_date, submission_date) = CURRENT_DATE
  AND final = true
  AND id != '11111111-2222-3333-4444-555555555555';

-- Now finalize our test submission
UPDATE submissions 
SET final = true 
WHERE id = '11111111-2222-3333-4444-555555555555';
-- Create a Service template for testing completeness
DO $$
DECLARE
    service_template_id uuid;
    sample_agency_id uuid;
BEGIN
    -- Get a sample agency for testing
    SELECT id INTO sample_agency_id FROM agencies LIMIT 1;
    
    IF sample_agency_id IS NOT NULL THEN
        -- Insert Service template
        INSERT INTO form_templates (agency_id, name, slug, role, status, settings_json)
        VALUES (
            sample_agency_id,
            'Service Scorecard',
            'service-scorecard-test',
            'Service',
            'draft',
            '{"dueBy": "23:59", "reminders": [], "spawnCap": 5, "countedDays": {"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}}'::jsonb
        )
        RETURNING id INTO service_template_id;

        -- Add built-in Service KPI fields
        INSERT INTO form_fields (form_template_id, key, label, type, required, builtin, position)
        VALUES 
            (service_template_id, 'team_member_id', 'Staff Member', 'select', true, true, 0),
            (service_template_id, 'outbound_calls', 'Outbound Calls', 'number', true, true, 1),
            (service_template_id, 'talk_minutes', 'Talk Minutes', 'number', true, true, 2),
            (service_template_id, 'mini_reviews', 'Mini Reviews', 'number', true, true, 3),
            (service_template_id, 'cross_sells_uncovered', 'Cross Sells Uncovered', 'number', false, true, 4),
            (service_template_id, 'submission_date', 'Submission Date', 'date', true, true, 1000),
            (service_template_id, 'work_date', 'Work Date', 'date', false, true, 1001);
    END IF;
END $$;
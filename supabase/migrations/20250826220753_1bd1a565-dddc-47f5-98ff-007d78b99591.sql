-- Add unique constraint to form_fields and seed built-in KPI fields
-- First add the unique constraint
ALTER TABLE form_fields ADD CONSTRAINT uidx_form_fields_template_key UNIQUE (form_template_id, key);

-- Seed built-in KPI fields for existing Sales and Service templates
DO $$
DECLARE
    template_rec RECORD;
    kpi_fields_json JSONB;
BEGIN
    -- Built-in KPI fields for Sales role
    kpi_fields_json := '[
        {
            "key": "outbound_calls",
            "label": "Outbound Calls",
            "type": "number",
            "required": true,
            "builtin": true,
            "position": 1
        },
        {
            "key": "talk_minutes", 
            "label": "Talk Minutes",
            "type": "number",
            "required": true,
            "builtin": true,
            "position": 2
        },
        {
            "key": "quoted_count",
            "label": "Quoted Households",
            "type": "number", 
            "required": true,
            "builtin": true,
            "position": 3
        },
        {
            "key": "sold_items",
            "label": "Sold Items",
            "type": "number",
            "required": false,
            "builtin": true,
            "position": 4
        },
        {
            "key": "sold_policies", 
            "label": "Sold Policies",
            "type": "number",
            "required": false,
            "builtin": true,
            "position": 5
        },
        {
            "key": "cross_sells_uncovered",
            "label": "Cross Sells Uncovered", 
            "type": "number",
            "required": false,
            "builtin": true,
            "position": 6
        }
    ]'::jsonb;
    
    -- Insert KPI fields for Sales templates
    FOR template_rec IN 
        SELECT id FROM form_templates WHERE role = 'Sales'
    LOOP
        INSERT INTO form_fields (form_template_id, key, label, type, required, builtin, position)
        SELECT 
            template_rec.id,
            field->>'key',
            field->>'label', 
            field->>'type',
            (field->>'required')::boolean,
            (field->>'builtin')::boolean,
            (field->>'position')::integer
        FROM jsonb_array_elements(kpi_fields_json) AS field
        ON CONFLICT (form_template_id, key) DO NOTHING;
    END LOOP;

    -- Built-in KPI fields for Service role  
    kpi_fields_json := '[
        {
            "key": "outbound_calls",
            "label": "Outbound Calls",
            "type": "number",
            "required": true,
            "builtin": true,
            "position": 1
        },
        {
            "key": "talk_minutes",
            "label": "Talk Minutes", 
            "type": "number",
            "required": true,
            "builtin": true,
            "position": 2
        },
        {
            "key": "mini_reviews",
            "label": "Mini Reviews",
            "type": "number",
            "required": true, 
            "builtin": true,
            "position": 3
        },
        {
            "key": "cross_sells_uncovered",
            "label": "Cross Sells Uncovered",
            "type": "number",
            "required": false,
            "builtin": true,
            "position": 4
        }
    ]'::jsonb;

    -- Insert KPI fields for Service templates
    FOR template_rec IN
        SELECT id FROM form_templates WHERE role = 'Service'  
    LOOP
        INSERT INTO form_fields (form_template_id, key, label, type, required, builtin, position)
        SELECT
            template_rec.id,
            field->>'key',
            field->>'label',
            field->>'type', 
            (field->>'required')::boolean,
            (field->>'builtin')::boolean,
            (field->>'position')::integer
        FROM jsonb_array_elements(kpi_fields_json) AS field
        ON CONFLICT (form_template_id, key) DO NOTHING;
    END LOOP;

    -- Add system fields to ALL templates
    FOR template_rec IN
        SELECT id FROM form_templates
    LOOP
        -- Staff dropdown (required)
        INSERT INTO form_fields (form_template_id, key, label, type, required, builtin, position)
        VALUES (template_rec.id, 'team_member_id', 'Staff Member', 'select', true, true, 0)
        ON CONFLICT (form_template_id, key) DO NOTHING;
        
        -- Submission Date (required)
        INSERT INTO form_fields (form_template_id, key, label, type, required, builtin, position) 
        VALUES (template_rec.id, 'submission_date', 'Submission Date', 'date', true, true, 1000)
        ON CONFLICT (form_template_id, key) DO NOTHING;
        
        -- Work Date (optional)
        INSERT INTO form_fields (form_template_id, key, label, type, required, builtin, position)
        VALUES (template_rec.id, 'work_date', 'Work Date', 'date', false, true, 1001) 
        ON CONFLICT (form_template_id, key) DO NOTHING;
    END LOOP;

    -- Update all templates to have proper settings_json structure
    UPDATE form_templates 
    SET settings_json = jsonb_build_object(
        'dueBy', COALESCE(settings_json->>'dueBy', '23:59'),
        'reminders', COALESCE(settings_json->'reminders', '[]'::jsonb),
        'spawnCap', COALESCE((settings_json->>'spawnCap')::integer, 10),
        'countedDays', COALESCE(settings_json->'countedDays', '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb)
    )
    WHERE settings_json IS NULL OR 
          NOT settings_json ? 'dueBy' OR
          NOT settings_json ? 'reminders' OR 
          NOT settings_json ? 'spawnCap' OR
          NOT settings_json ? 'countedDays';

END $$;
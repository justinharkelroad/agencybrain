-- Add 'multiselect' to allowed field_type values
ALTER TABLE form_section_field_types 
DROP CONSTRAINT form_section_field_types_field_type_check;

ALTER TABLE form_section_field_types 
ADD CONSTRAINT form_section_field_types_field_type_check 
CHECK (field_type = ANY (ARRAY['text'::text, 'longtext'::text, 'select'::text, 'multiselect'::text, 'number'::text, 'currency'::text]));

-- Now update policy_type to multiselect
UPDATE form_section_field_types 
SET field_type = 'multiselect', updated_at = now()
WHERE field_key = 'policy_type' AND section_type = 'soldDetails';
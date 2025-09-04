-- Fix unique constraint to allow same field_key for different sections
-- Drop the incorrect unique constraint on field_key alone
ALTER TABLE public.form_section_field_types 
DROP CONSTRAINT form_section_field_types_field_key_key;

-- Add proper unique constraint on the combination of section_type and field_key
ALTER TABLE public.form_section_field_types 
ADD CONSTRAINT form_section_field_types_section_field_unique 
UNIQUE (section_type, field_key);

-- Now insert the missing lead_source field for quotedDetails section
INSERT INTO public.form_section_field_types (
    section_type,
    field_key,
    field_label,
    field_type,
    is_sticky,
    is_system_required,
    order_index,
    created_at,
    updated_at
) VALUES (
    'quotedDetails',
    'lead_source',
    'Lead Source',
    'select',
    true,
    true,
    2,
    now(),
    now()
);
-- Add missing lead_source field to quotedDetails section
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
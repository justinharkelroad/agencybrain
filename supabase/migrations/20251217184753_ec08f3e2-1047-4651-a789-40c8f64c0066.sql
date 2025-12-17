-- Fix duplicate custom field keys in the Quote Log form
UPDATE form_templates 
SET schema_json = jsonb_set(
  schema_json,
  '{customFields}',
  '[
    {"key": "field_prospect_name", "label": "Prospect Name", "required": true, "type": "text"},
    {"key": "field_lead_source", "label": "Lead Source", "required": true, "type": "dropdown", "options": ["Cross Sell", "Winback", "ReQuote", "Referral", "Call In/Walk In", "Internet Lead", "Other"]},
    {"key": "field_items_quoted", "label": "Items Quoted", "required": true, "type": "text"},
    {"key": "field_policies_quoted", "label": "Policies Quoted", "required": true, "type": "text"},
    {"key": "field_premium_quoted", "label": "Premium Quoted", "required": true, "type": "text"},
    {"key": "field_bundled", "label": "Bundled", "required": true, "type": "dropdown", "options": ["Yes", "No"]},
    {"key": "field_hearsay_opt_in", "label": "Hearsay Opt In", "required": true, "type": "dropdown", "options": ["Yes", "No", "I forgot to ask"]},
    {"key": "field_objection", "label": "Objection", "required": true, "type": "longtext"}
  ]'::jsonb
)
WHERE id = '1ec04368-e4f4-4ed5-8c69-5e340295dedb';
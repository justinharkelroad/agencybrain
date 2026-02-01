-- ============================================================================
-- PHASE 2: Add Zip Code to Scorecard Form
-- 
-- Purpose: Require zip code collection in quotedDetails so we can generate
--          proper household_key for deduplication
--
-- PREREQUISITE: Phase 1 must be verified working first
-- See LQS_METRICS_SYNC_IMPLEMENTATION.md for full plan.
-- ============================================================================

-- ============================================================================
-- PART A: Update Form Template Schema (MANUAL STEP)
-- ============================================================================
-- 
-- This cannot be done via pure SQL - the form_templates.schema_json needs
-- to be updated to add the zip_code field to quotedDetails.repeaterSections
--
-- The field to add:
-- {
--   "key": "zip_code",
--   "label": "Zip Code", 
--   "type": "text",
--   "required": true,
--   "placeholder": "Enter 5-digit zip code"
-- }
--
-- Location: schema_json.repeaterSections.quotedDetails.fields[]
--
-- This should be done via the Form Builder UI or through a targeted UPDATE.
-- Example (adjust form_template_id as needed):
--
-- UPDATE form_templates
-- SET schema_json = jsonb_set(
--   schema_json,
--   '{repeaterSections,quotedDetails,fields}',
--   (schema_json->'repeaterSections'->'quotedDetails'->'fields') || 
--   '[{"key":"zip_code","label":"Zip Code","type":"text","required":true}]'::jsonb
-- )
-- WHERE id = 'YOUR_FORM_TEMPLATE_ID';


-- ============================================================================
-- PART B: Update the Flattener Function
-- ============================================================================
-- 
-- The flatten_quoted_household_details_enhanced function needs to extract
-- zip_code from the payload and store it in quoted_household_details.zip_code
--
-- IMPORTANT: You must examine the actual current flattener function before
-- modifying it. Run this query to see the current definition:
--
-- SELECT pg_get_functiondef(oid) 
-- FROM pg_proc 
-- WHERE proname = 'flatten_quoted_household_details_enhanced';
--
-- Then modify it to include:
-- 
-- 1. Extract zip_code from the detail item:
--    v_zip_code := detail_item->>'zip_code';
--
-- 2. Include zip_code in the INSERT statement:
--    INSERT INTO quoted_household_details (..., zip_code, ...)
--    VALUES (..., v_zip_code, ...);


-- ============================================================================
-- PHASE 2 VERIFICATION QUERIES
-- ============================================================================

-- Check 1: Form template has zip_code field
-- (Replace with your actual form template ID)
SELECT 
  id,
  title,
  jsonb_path_query_array(
    schema_json, 
    '$.repeaterSections.quotedDetails.fields[*].key'
  ) as quoted_detail_fields
FROM form_templates
WHERE role = 'Sales'
LIMIT 5;
-- Expected: zip_code should appear in the array

-- Check 2: Submit a test scorecard with zip code, then verify storage
SELECT 
  id, 
  household_name, 
  zip_code, 
  created_at
FROM quoted_household_details
WHERE zip_code IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
-- Expected: zip_code should be populated for new submissions


-- ============================================================================
-- PHASE 2 NOTES
-- ============================================================================
-- 
-- After Phase 2:
-- - New scorecard submissions will collect zip code
-- - quoted_household_details.zip_code will be populated
-- - This enables Phase 3 to generate proper household_key for matching
--
-- Historical data will NOT have zip_code - that's acceptable.
-- Deduplication will only work for new data going forward.

-- Phase 1: Convert policy_type from single-select to multi-select

-- 1.1 Update form_section_field_types to use 'multiselect' type
UPDATE form_section_field_types 
SET field_type = 'multiselect', updated_at = now()
WHERE field_key = 'policy_type' AND section_type = 'quotedDetails';

-- 1.2 Alter quoted_household_details.policy_type from TEXT to TEXT[]
ALTER TABLE quoted_household_details 
ALTER COLUMN policy_type TYPE TEXT[] 
USING CASE 
  WHEN policy_type IS NOT NULL THEN ARRAY[policy_type] 
  ELSE NULL 
END;

-- 1.3 Alter sold_policy_details.policy_type from TEXT NOT NULL to TEXT[]
-- First drop NOT NULL constraint
ALTER TABLE sold_policy_details ALTER COLUMN policy_type DROP NOT NULL;

-- Then convert to array
ALTER TABLE sold_policy_details 
ALTER COLUMN policy_type TYPE TEXT[] 
USING CASE 
  WHEN policy_type IS NOT NULL THEN ARRAY[policy_type] 
  ELSE NULL 
END;
-- Step 1: Add 'Owner' to app_member_role enum
ALTER TYPE app_member_role ADD VALUE IF NOT EXISTS 'Owner';
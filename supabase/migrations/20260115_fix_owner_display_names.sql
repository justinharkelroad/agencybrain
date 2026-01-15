-- Fix historical activity records where agency owner email was used instead of name
UPDATE renewal_activities 
SET created_by_display_name = 'Heather Ebersole' 
WHERE created_by_display_name = 'hebersole@allstate.com';

-- Also fix the renewal_records last_activity_by_display_name if affected
UPDATE renewal_records 
SET last_activity_by_display_name = 'Heather Ebersole' 
WHERE last_activity_by_display_name = 'hebersole@allstate.com';

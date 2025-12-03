
-- Move Justin Hark staff user to HFI INC agency and link to existing team member
UPDATE staff_users 
SET 
  agency_id = '3c58f6f6-99cd-4c7d-97bc-3b16310ed4ba',
  team_member_id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316'
WHERE id = '2d850763-ddbe-4101-9820-7dde04ac953c';

-- Update team member name to match (was "Jane Doe" placeholder)
UPDATE team_members 
SET name = 'Justin Harkelroad'
WHERE id = '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316';


-- NUCLEAR DELETE: Clean slate for Giddings Insurance Agency team members
-- Delete staff_users first (foreign key dependency)
DELETE FROM staff_users 
WHERE team_member_id IN (
  'fe843307-da9f-4177-93bb-525952b25251',
  'a9cd8a32-3509-4a1d-b304-2d9e321187ff'
);

-- Delete team_members
DELETE FROM team_members 
WHERE id IN (
  'fe843307-da9f-4177-93bb-525952b25251',
  'ff98ad3c-80e5-4ae6-a2b8-468d0b4365bd',
  'a9cd8a32-3509-4a1d-b304-2d9e321187ff'
);

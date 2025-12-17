-- Delete staff_users linked to team members first (FK constraint)
DELETE FROM public.staff_users 
WHERE team_member_id IN (
  SELECT id FROM public.team_members 
  WHERE agency_id = '2bd857f0-cbc4-4a38-ad77-8621b1b35983'
);

-- Delete team members
DELETE FROM public.team_members 
WHERE agency_id = '2bd857f0-cbc4-4a38-ad77-8621b1b35983';
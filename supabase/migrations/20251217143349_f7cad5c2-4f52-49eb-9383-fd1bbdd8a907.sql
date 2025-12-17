-- Delete team member "Landon" (landonfaina@allstate.com) and all related records

-- Delete agency_calls for this team member
DELETE FROM agency_calls WHERE team_member_id = '2db264af-2f44-4d8f-8d22-25981107545e';

-- Delete member_checklist_items for this team member
DELETE FROM member_checklist_items WHERE member_id = '2db264af-2f44-4d8f-8d22-25981107545e';

-- Delete staff_user record (linked to this team member)
DELETE FROM staff_users WHERE id = '5e427306-cb56-49a4-821b-bd2cdd267831';

-- Delete the team member record
DELETE FROM team_members WHERE id = '2db264af-2f44-4d8f-8d22-25981107545e';
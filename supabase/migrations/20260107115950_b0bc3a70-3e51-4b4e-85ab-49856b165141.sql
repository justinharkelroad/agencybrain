-- Update lqs_households.team_member_id from lqs_sales.team_member_id where sale has it
UPDATE lqs_households h
SET team_member_id = ls.team_member_id
FROM lqs_sales ls
WHERE ls.household_id = h.id
  AND ls.team_member_id IS NOT NULL
  AND (h.team_member_id IS NULL OR h.team_member_id != ls.team_member_id)
  AND h.status = 'sold'
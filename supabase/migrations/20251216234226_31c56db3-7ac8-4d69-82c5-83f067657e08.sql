-- NUCLEAR DELETE: Clean slate for AgencyBrain Tester - 5 team members
-- No staff_users linked, no dependencies found

DELETE FROM team_members 
WHERE id IN (
  'f0cebb98-a42b-47dc-8503-6709279e44f0',  -- Tammy Williams
  '00ca6af7-5835-441d-9592-1ed73609fc4d',  -- Eric Haygood
  'a46b692c-3175-4212-bcec-c4be63b395b6',  -- Monica Morales
  'a1f3fd03-3fa0-48cb-81ec-bc53b38d4c88',  -- Gunnar Palic
  'a7af7ce3-a209-4324-9966-74f8b3043fe7'   -- Blake Meil
);
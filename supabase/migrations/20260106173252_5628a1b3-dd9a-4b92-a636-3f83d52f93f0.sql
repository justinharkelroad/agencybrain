-- Create agency for Kyle Hobbs
INSERT INTO agencies (name)
VALUES ('Kyle Hobbs Agency')
ON CONFLICT DO NOTHING;

-- Update Kyle's profile with the new agency_id
UPDATE profiles 
SET agency_id = (SELECT id FROM agencies WHERE name = 'Kyle Hobbs Agency' LIMIT 1)
WHERE email = 'kylehobbs@allstate.com' AND agency_id IS NULL;

-- Create Owner team member record for Kyle
INSERT INTO team_members (agency_id, name, email, role, employment, status)
SELECT 
  (SELECT id FROM agencies WHERE name = 'Kyle Hobbs Agency' LIMIT 1),
  'Kyle Hobbs',
  'kylehobbs@allstate.com',
  'Owner',
  'Full-time',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE email = 'kylehobbs@allstate.com'
);
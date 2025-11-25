-- Add unique constraint on username
ALTER TABLE staff_users ADD CONSTRAINT staff_users_username_key UNIQUE (username);

-- Insert test staff user with bcrypt hash (Password: TestPassword123!)
DO $$
DECLARE
  first_agency_id uuid;
BEGIN
  SELECT id INTO first_agency_id FROM agencies LIMIT 1;
  
  IF first_agency_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM staff_users WHERE username = 'test_staff') THEN
    INSERT INTO staff_users (username, password_hash, display_name, agency_id, is_active)
    VALUES (
      'test_staff',
      '$2a$10$rZS4j8YMqQR.VG7X7Y8tO.pV6N.pqVJf.M8KNq.8Z4Yw9Y8X7Y6W2',
      'Test Staff User',
      first_agency_id,
      true
    );
  END IF;
END $$;
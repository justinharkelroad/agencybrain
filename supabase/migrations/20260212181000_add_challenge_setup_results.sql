-- Create challenge_setup_results table
-- Stores post-purchase setup data (credentials, recovery URL) keyed by Stripe session ID.
-- Needed because the success page loads before the buyer is authenticated,
-- so we can't use RLS. The Stripe session ID is unguessable.

CREATE TABLE challenge_setup_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id text NOT NULL UNIQUE,
  agency_id uuid REFERENCES agencies(id),
  user_id uuid,
  email text,
  staff_credentials jsonb DEFAULT '[]',  -- [{username, password, name}]
  owner_setup_url text,                   -- Supabase recovery link
  purchase_id uuid,
  quantity int,
  start_date date,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

ALTER TABLE challenge_setup_results ENABLE ROW LEVEL SECURITY;

-- Allow anon + authenticated to read non-expired rows (needed for success page polling)
-- Only service role writes (edge functions)
CREATE POLICY "anon_read_by_session" ON challenge_setup_results
  FOR SELECT TO anon, authenticated USING (expires_at > now());

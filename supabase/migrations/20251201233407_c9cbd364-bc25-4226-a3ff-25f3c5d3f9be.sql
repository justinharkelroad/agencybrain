-- Add email column to staff_users
ALTER TABLE public.staff_users
ADD COLUMN email text;

-- Create unique index for email (allows nulls for existing users)
CREATE UNIQUE INDEX idx_staff_users_email ON staff_users(email) WHERE email IS NOT NULL;

-- Create staff_password_reset_tokens table
CREATE TABLE public.staff_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast token lookup
CREATE INDEX idx_staff_reset_tokens_token ON staff_password_reset_tokens(token);
CREATE INDEX idx_staff_reset_tokens_expiry ON staff_password_reset_tokens(staff_user_id, expires_at);

-- RLS - only service role can access (edge functions)
ALTER TABLE staff_password_reset_tokens ENABLE ROW LEVEL SECURITY;
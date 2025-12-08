-- Security fix: Remove public read access to agencies table
-- Edge functions use service role and bypass RLS, so they are not affected
-- Sensitive data (emails, phones, addresses, agent names) will no longer be publicly accessible

DROP POLICY IF EXISTS "public_can_select_agency_basic" ON agencies;
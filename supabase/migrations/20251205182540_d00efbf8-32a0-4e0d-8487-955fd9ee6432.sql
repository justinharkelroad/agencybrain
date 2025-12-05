-- Fix RLS policies on process_vault_types to target 'authenticated' role instead of 'public'

-- Drop the misconfigured policies
DROP POLICY IF EXISTS "Admins can insert process vault types" ON process_vault_types;
DROP POLICY IF EXISTS "Admins can delete process vault types" ON process_vault_types;
DROP POLICY IF EXISTS "Admins can update process vault types" ON process_vault_types;

-- Recreate INSERT policy with correct role
CREATE POLICY "Admins can insert process vault types"
ON process_vault_types
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Recreate DELETE policy with correct role
CREATE POLICY "Admins can delete process vault types"
ON process_vault_types
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Recreate UPDATE policy with correct role
CREATE POLICY "Admins can update process vault types"
ON process_vault_types
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
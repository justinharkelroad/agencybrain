-- Allow admins to insert focus items for any user
CREATE POLICY "Admins can insert focus items for any user"
ON focus_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
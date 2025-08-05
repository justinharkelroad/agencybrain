-- Add admin RLS policies to allow admins to view all periods and uploads

-- Policy: Admins can view all periods
CREATE POLICY "Admins can view all periods" ON periods
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can view all uploads  
CREATE POLICY "Admins can view all uploads" ON uploads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
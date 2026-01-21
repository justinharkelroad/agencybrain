-- ============================================
-- FIX: Key Employee Tier Inheritance
-- Uses invited_by column for exact owner lookup
-- ============================================

-- Drop existing policies that may be over-permissive
DROP POLICY IF EXISTS "users_view_sp_categories" ON sp_categories;
DROP POLICY IF EXISTS "users_view_sp_modules" ON sp_modules;
DROP POLICY IF EXISTS "users_view_sp_lessons" ON sp_lessons;

-- sp_categories: Key employees inherit tier from invited_by owner
CREATE POLICY "users_view_sp_categories" ON sp_categories
  FOR SELECT USING (
    is_published = true AND (
      -- Direct tier access via user's own profile
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
          (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(access_tiers))
          OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(access_tiers))
        )
      )
      -- Admins see all published content
      OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
      -- Key employees inherit tier from the owner who invited them
      OR EXISTS (
        SELECT 1 FROM key_employees ke 
        JOIN profiles owner_p ON owner_p.id = ke.invited_by
        WHERE ke.user_id = auth.uid()
          AND (
            (owner_p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(access_tiers))
            OR (owner_p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(access_tiers))
          )
      )
    )
  );

-- sp_modules: Check parent category access via same logic
CREATE POLICY "users_view_sp_modules" ON sp_modules
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM sp_categories sc
      WHERE sc.id = sp_modules.category_id
        AND sc.is_published = true
        AND (
          EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
              (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
              OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
            )
          )
          OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
          OR EXISTS (
            SELECT 1 FROM key_employees ke 
            JOIN profiles owner_p ON owner_p.id = ke.invited_by
            WHERE ke.user_id = auth.uid()
              AND (
                (owner_p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
                OR (owner_p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
              )
          )
        )
    )
  );

-- sp_lessons: Check parent module → category access via same logic
CREATE POLICY "users_view_sp_lessons" ON sp_lessons
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM sp_modules sm
      JOIN sp_categories sc ON sc.id = sm.category_id
      WHERE sm.id = sp_lessons.module_id
        AND sm.is_published = true
        AND sc.is_published = true
        AND (
          EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
              (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
              OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
            )
          )
          OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
          OR EXISTS (
            SELECT 1 FROM key_employees ke 
            JOIN profiles owner_p ON owner_p.id = ke.invited_by
            WHERE ke.user_id = auth.uid()
              AND (
                (owner_p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
                OR (owner_p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
              )
          )
        )
    )
  );
-- Fix Key Employee access to Standard Playbook content
-- Key employees should have access to 'one_on_one' tier content

-- Drop existing policies
DROP POLICY IF EXISTS "users_view_sp_categories" ON sp_categories;
DROP POLICY IF EXISTS "users_view_sp_modules" ON sp_modules;
DROP POLICY IF EXISTS "users_view_sp_lessons" ON sp_lessons;

-- Recreate sp_categories policy with key employee access
CREATE POLICY "users_view_sp_categories" ON sp_categories
  FOR SELECT USING (
    is_published = true AND (
      -- Normal tier-based access via profile
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
          (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(access_tiers))
          OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(access_tiers))
        )
      )
      -- Key employees get access to one_on_one tier content
      OR (
        'one_on_one' = ANY(access_tiers) AND 
        EXISTS (SELECT 1 FROM key_employees ke WHERE ke.user_id = auth.uid())
      )
    )
  );

-- Recreate sp_modules policy with key employee access
CREATE POLICY "users_view_sp_modules" ON sp_modules
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM sp_categories sc WHERE sc.id = category_id AND sc.is_published = true AND (
        -- Normal tier-based access via profile
        EXISTS (
          SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
            (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
            OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
          )
        )
        -- Key employees get access to one_on_one tier content
        OR (
          'one_on_one' = ANY(sc.access_tiers) AND 
          EXISTS (SELECT 1 FROM key_employees ke WHERE ke.user_id = auth.uid())
        )
      )
    )
  );

-- Recreate sp_lessons policy with key employee access
CREATE POLICY "users_view_sp_lessons" ON sp_lessons
  FOR SELECT USING (
    is_published = true AND EXISTS (
      SELECT 1 FROM sp_modules sm JOIN sp_categories sc ON sc.id = sm.category_id
      WHERE sm.id = module_id AND sm.is_published = true AND sc.is_published = true AND (
        -- Normal tier-based access via profile
        EXISTS (
          SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
            (p.membership_tier = 'Boardroom' AND 'boardroom' = ANY(sc.access_tiers))
            OR (p.membership_tier = '1:1 Coaching' AND 'one_on_one' = ANY(sc.access_tiers))
          )
        )
        -- Key employees get access to one_on_one tier content
        OR (
          'one_on_one' = ANY(sc.access_tiers) AND 
          EXISTS (SELECT 1 FROM key_employees ke WHERE ke.user_id = auth.uid())
        )
      )
    )
  );

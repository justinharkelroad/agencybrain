-- Multi-Level Training Assignments
-- Extends sp_assignments and training_assignments to support category, module, AND lesson-level assignments

-- ============ SP ASSIGNMENTS: add module + lesson FKs ============

-- Allow sp_category_id to be null (module or lesson assignments won't have it)
ALTER TABLE sp_assignments ALTER COLUMN sp_category_id DROP NOT NULL;

-- Add module and lesson FK columns
ALTER TABLE sp_assignments
  ADD COLUMN sp_module_id uuid REFERENCES sp_modules(id) ON DELETE CASCADE,
  ADD COLUMN sp_lesson_id uuid REFERENCES sp_lessons(id) ON DELETE CASCADE;

-- CHECK: exactly one of the three FKs must be non-null
ALTER TABLE sp_assignments
  ADD CONSTRAINT sp_assignments_exactly_one_target CHECK (
    (CASE WHEN sp_category_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN sp_module_id   IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN sp_lesson_id   IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

-- Per-level unique constraints (PG NULLs are distinct in UNIQUE, so these work)
-- existing UNIQUE(staff_user_id, sp_category_id) stays
ALTER TABLE sp_assignments
  ADD CONSTRAINT sp_assignments_staff_module_unique UNIQUE (staff_user_id, sp_module_id);
ALTER TABLE sp_assignments
  ADD CONSTRAINT sp_assignments_staff_lesson_unique UNIQUE (staff_user_id, sp_lesson_id);

-- Partial indexes for new FK columns
CREATE INDEX idx_sp_assignments_module ON sp_assignments(sp_module_id) WHERE sp_module_id IS NOT NULL;
CREATE INDEX idx_sp_assignments_lesson ON sp_assignments(sp_lesson_id) WHERE sp_lesson_id IS NOT NULL;


-- ============ TRAINING ASSIGNMENTS: add category + lesson FKs ============

-- Allow module_id to be null (category or lesson assignments won't have it)
ALTER TABLE training_assignments ALTER COLUMN module_id DROP NOT NULL;

-- Add category and lesson FK columns
ALTER TABLE training_assignments
  ADD COLUMN category_id uuid REFERENCES training_categories(id) ON DELETE CASCADE,
  ADD COLUMN lesson_id uuid REFERENCES training_lessons(id) ON DELETE CASCADE;

-- Add assigned_by_staff_id and seen_at for parity with sp_assignments
ALTER TABLE training_assignments
  ADD COLUMN assigned_by_staff_id uuid REFERENCES staff_users(id),
  ADD COLUMN seen_at timestamptz;

-- CHECK: exactly one of the three FKs must be non-null
ALTER TABLE training_assignments
  ADD CONSTRAINT training_assignments_exactly_one_target CHECK (
    (CASE WHEN category_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN module_id   IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN lesson_id   IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

-- Per-level unique constraints
-- existing UNIQUE(staff_user_id, module_id) stays
ALTER TABLE training_assignments
  ADD CONSTRAINT training_assignments_staff_category_unique UNIQUE (staff_user_id, category_id);
ALTER TABLE training_assignments
  ADD CONSTRAINT training_assignments_staff_lesson_unique UNIQUE (staff_user_id, lesson_id);

-- Partial indexes
CREATE INDEX idx_training_assignments_category ON training_assignments(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_training_assignments_lesson ON training_assignments(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX idx_training_assignments_unseen ON training_assignments(staff_user_id) WHERE seen_at IS NULL;

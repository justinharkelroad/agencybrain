-- Make user_id nullable for staff-created focus items
ALTER TABLE focus_items ALTER COLUMN user_id DROP NOT NULL;
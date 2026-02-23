-- Add cover_image_url to training_categories for card-based navigation
ALTER TABLE training_categories ADD COLUMN IF NOT EXISTS cover_image_url text;

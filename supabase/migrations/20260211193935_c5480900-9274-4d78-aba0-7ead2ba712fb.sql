ALTER TABLE winback_households
  ADD COLUMN last_upload_id uuid REFERENCES winback_uploads(id) ON DELETE SET NULL;
-- Add documents_json column to sp_lessons
ALTER TABLE sp_lessons ADD COLUMN IF NOT EXISTS documents_json jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single document to new array format
UPDATE sp_lessons 
SET documents_json = jsonb_build_array(
  jsonb_build_object('id', gen_random_uuid()::text, 'url', document_url, 'name', document_name)
)
WHERE document_url IS NOT NULL AND document_url != '';
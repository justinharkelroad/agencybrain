-- Fix existing documents that are missing https:// prefix
UPDATE sp_lessons 
SET documents_json = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', doc->>'id',
      'name', doc->>'name', 
      'url', CASE 
        WHEN doc->>'url' LIKE 'http%' THEN doc->>'url'
        ELSE 'https://' || (doc->>'url')
      END
    )
  )
  FROM jsonb_array_elements(documents_json) AS doc
)
WHERE documents_json IS NOT NULL 
  AND jsonb_array_length(documents_json) > 0;
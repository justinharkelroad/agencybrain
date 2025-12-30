-- Backfill NULL slugs with unique suffixes to avoid collisions
UPDATE agencies 
SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g')) || '-' || left(id::text, 8)
WHERE slug IS NULL;
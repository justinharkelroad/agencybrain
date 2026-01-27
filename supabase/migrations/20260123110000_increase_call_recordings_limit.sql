-- Increase call-recordings bucket limit from 25MB to 75MB
-- This fixes the issue where owner/admin uploads over 25MB silently hang
-- because they upload directly to storage (unlike staff who use signed URLs)

UPDATE storage.buckets
SET file_size_limit = 78643200  -- 75MB in bytes
WHERE id = 'call-recordings';

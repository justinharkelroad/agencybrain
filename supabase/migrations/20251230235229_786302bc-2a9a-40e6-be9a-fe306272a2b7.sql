-- Function to auto-generate slug from agency name
CREATE OR REPLACE FUNCTION generate_agency_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Only generate if slug is NULL or empty
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    -- Generate base slug from name (same pattern as handle_new_user)
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    -- Handle empty slug edge case
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'agency';
    END IF;
    
    final_slug := base_slug;
    
    -- Check for collisions and append counter if needed
    WHILE EXISTS (
      SELECT 1 FROM agencies 
      WHERE slug = final_slug 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    
    NEW.slug := final_slug;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run BEFORE INSERT on agencies
DROP TRIGGER IF EXISTS generate_agency_slug_trigger ON agencies;
CREATE TRIGGER generate_agency_slug_trigger
  BEFORE INSERT ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION generate_agency_slug();
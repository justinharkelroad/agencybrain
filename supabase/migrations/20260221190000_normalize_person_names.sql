-- Normalize person-name fields across portal entry points.
-- Applies to admin/staff/owner writes and edge functions.

CREATE OR REPLACE FUNCTION public.normalize_person_name(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
  ch text;
  result text := '';
  capitalize_next boolean := true;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(btrim(input_text), '\s+', ' ', 'g');
  IF cleaned = '' THEN
    RETURN '';
  END IF;

  FOR i IN 1..char_length(cleaned) LOOP
    ch := substr(cleaned, i, 1);
    IF ch ~ '[[:alpha:]]' THEN
      IF capitalize_next THEN
        result := result || upper(ch);
      ELSE
        result := result || lower(ch);
      END IF;
      capitalize_next := false;
    ELSE
      result := result || ch;
      IF ch IN (' ', '-', '''') THEN
        capitalize_next := true;
      END IF;
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_person_name_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'team_members' THEN
    IF NEW.name IS NOT NULL THEN
      NEW.name := public.normalize_person_name(NEW.name);
    END IF;
  ELSIF TG_TABLE_NAME = 'staff_users' THEN
    IF NEW.display_name IS NOT NULL THEN
      NEW.display_name := public.normalize_person_name(NEW.display_name);
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.full_name IS NOT NULL THEN
      NEW.full_name := public.normalize_person_name(NEW.full_name);
    END IF;
  ELSIF TG_TABLE_NAME = 'key_employees' THEN
    IF NEW.full_name IS NOT NULL THEN
      NEW.full_name := public.normalize_person_name(NEW.full_name);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_team_members_name ON public.team_members;
CREATE TRIGGER trg_normalize_team_members_name
BEFORE INSERT OR UPDATE OF name ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.normalize_person_name_fields();

DROP TRIGGER IF EXISTS trg_normalize_staff_users_display_name ON public.staff_users;
CREATE TRIGGER trg_normalize_staff_users_display_name
BEFORE INSERT OR UPDATE OF display_name ON public.staff_users
FOR EACH ROW
EXECUTE FUNCTION public.normalize_person_name_fields();

DROP TRIGGER IF EXISTS trg_normalize_profiles_full_name ON public.profiles;
CREATE TRIGGER trg_normalize_profiles_full_name
BEFORE INSERT OR UPDATE OF full_name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_person_name_fields();

DROP TRIGGER IF EXISTS trg_normalize_key_employees_full_name ON public.key_employees;
CREATE TRIGGER trg_normalize_key_employees_full_name
BEFORE INSERT OR UPDATE OF full_name ON public.key_employees
FOR EACH ROW
EXECUTE FUNCTION public.normalize_person_name_fields();

UPDATE public.team_members
SET name = public.normalize_person_name(name)
WHERE name IS NOT NULL
  AND name <> public.normalize_person_name(name);

UPDATE public.staff_users
SET display_name = public.normalize_person_name(display_name)
WHERE display_name IS NOT NULL
  AND display_name <> public.normalize_person_name(display_name);

UPDATE public.profiles
SET full_name = public.normalize_person_name(full_name)
WHERE full_name IS NOT NULL
  AND full_name <> public.normalize_person_name(full_name);

UPDATE public.key_employees
SET full_name = public.normalize_person_name(full_name)
WHERE full_name IS NOT NULL
  AND full_name <> public.normalize_person_name(full_name);

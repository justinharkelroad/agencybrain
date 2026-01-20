-- Drop unused function overloads to eliminate PostgreSQL ambiguity
-- Only keeping the 7-param version which the frontend uses

-- Drop the old 5-param overload
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(uuid, text, text, integer, integer);

-- Drop the 6-param cursor-based overload  
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(uuid, text, text, integer, text, text);

-- Drop the 8-param cursor-based overload
DROP FUNCTION IF EXISTS public.get_contacts_by_stage(uuid, text, text, text, text, uuid, text, integer);
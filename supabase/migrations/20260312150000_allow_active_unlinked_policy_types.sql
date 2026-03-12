-- Re-allow agencies to activate policy types without linking them to a canonical product type.
-- Unlinked policy types still lose canonical comp metadata, but they should remain usable.

DROP TRIGGER IF EXISTS enforce_active_policy_type_link ON public.policy_types;

DROP FUNCTION IF EXISTS public.enforce_active_policy_type_link();

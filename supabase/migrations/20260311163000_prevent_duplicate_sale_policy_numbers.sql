-- Prevent duplicate policy-number sales inside the same agency.
-- This blocks manual/PDF/staff sale creation from creating a second dashboard sale
-- when the policy already belongs to another sale row for that agency.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_sale_policy_numbers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id uuid;
  v_existing_sale_id uuid;
BEGIN
  IF NEW.policy_number IS NULL OR btrim(NEW.policy_number) = '' THEN
    RETURN NEW;
  END IF;

  SELECT s.agency_id
    INTO v_agency_id
  FROM sales s
  WHERE s.id = NEW.sale_id;

  IF v_agency_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sp.sale_id
    INTO v_existing_sale_id
  FROM sale_policies sp
  JOIN sales s ON s.id = sp.sale_id
  WHERE sp.policy_number = NEW.policy_number
    AND sp.sale_id <> NEW.sale_id
    AND s.agency_id = v_agency_id
  LIMIT 1;

  IF v_existing_sale_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Policy number % already exists on sale % for agency %',
      NEW.policy_number,
      v_existing_sale_id,
      v_agency_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_sale_policy_numbers ON public.sale_policies;

CREATE TRIGGER trg_prevent_duplicate_sale_policy_numbers
BEFORE INSERT OR UPDATE OF policy_number, sale_id
ON public.sale_policies
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_sale_policy_numbers();

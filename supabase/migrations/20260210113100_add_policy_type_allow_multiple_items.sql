-- Add agency-configurable multi-item behavior for policy types
ALTER TABLE public.policy_types
ADD COLUMN IF NOT EXISTS allow_multiple_items boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.policy_types.allow_multiple_items IS
'When true, this policy type can include multiple line items in sale entry forms.';

-- Backfill existing agencies to preserve current behavior for known multi-item products
UPDATE public.policy_types pt
SET allow_multiple_items = true
FROM public.product_types prod
WHERE pt.product_type_id = prod.id
  AND lower(trim(prod.name)) IN (
    'standard auto',
    'non-standard auto',
    'specialty auto',
    'boatowners',
    'motorcycle',
    'off-road vehicle',
    'off road vehicle',
    'atv'
  );

-- Fallback by policy type display name for any unlinked policy types
UPDATE public.policy_types
SET allow_multiple_items = true
WHERE allow_multiple_items = false
  AND lower(trim(name)) IN (
    'standard auto',
    'non-standard auto',
    'specialty auto',
    'boatowners',
    'motorcycle',
    'off-road vehicle',
    'off road vehicle',
    'atv'
  );

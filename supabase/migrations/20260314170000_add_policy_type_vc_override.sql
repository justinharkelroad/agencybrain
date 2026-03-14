-- Per-agency VC override on policy_types.
-- NULL = inherit from linked product_types.is_vc_item (default for all existing agencies).
-- Explicit true/false overrides the global setting.
-- Use case: CA/CT/FL agencies where only Auto/Life count toward VC.

ALTER TABLE public.policy_types
  ADD COLUMN IF NOT EXISTS is_vc_item boolean NULL;

COMMENT ON COLUMN public.policy_types.is_vc_item IS
  'Per-agency VC override. NULL = inherit from linked product_types.is_vc_item. Explicit true/false overrides the global setting.';

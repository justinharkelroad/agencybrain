-- Backfill contact_id on onboarding_instances where it was not set at creation time.
-- Resolves from sales.contact_id or lqs_households.contact_id.

-- From sales
UPDATE onboarding_instances oi
SET contact_id = s.contact_id
FROM sales s
WHERE oi.sale_id = s.id
  AND oi.contact_id IS NULL
  AND s.contact_id IS NOT NULL;

-- From lqs_households
UPDATE onboarding_instances oi
SET contact_id = h.contact_id
FROM lqs_households h
WHERE oi.household_id = h.id
  AND oi.contact_id IS NULL
  AND h.contact_id IS NOT NULL;

-- Enforce canonical household key format on the two core relationship tables.
-- Format stays aligned with generate_household_key(): LAST_FIRST_ZIP5
-- where names are uppercase alpha-only and ZIP is a 5-char uppercase alphanumeric segment.

ALTER TABLE public.lqs_households
  DROP CONSTRAINT IF EXISTS lqs_households_household_key_canonical_format;

ALTER TABLE public.lqs_households
  ADD CONSTRAINT lqs_households_household_key_canonical_format
  CHECK (household_key ~ '^[A-Z]+_[A-Z]+_[A-Z0-9]{5}$');

ALTER TABLE public.agency_contacts
  DROP CONSTRAINT IF EXISTS agency_contacts_household_key_canonical_format;

ALTER TABLE public.agency_contacts
  ADD CONSTRAINT agency_contacts_household_key_canonical_format
  CHECK (household_key ~ '^[A-Z]+_[A-Z]+_[A-Z0-9]{5}$');

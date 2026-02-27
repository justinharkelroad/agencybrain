-- Add prior insurance company tracking to quoted households
ALTER TABLE lqs_households
  ADD COLUMN prior_insurance_company_id uuid
  REFERENCES prior_insurance_companies(id) ON DELETE SET NULL;

CREATE INDEX idx_lqs_households_prior_insurance_company
  ON lqs_households(prior_insurance_company_id)
  WHERE prior_insurance_company_id IS NOT NULL;

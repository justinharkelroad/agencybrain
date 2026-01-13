-- Function to recalculate win-back dates for all policies to ensure they're in the future
CREATE OR REPLACE FUNCTION recalculate_all_winback_dates(p_agency_id UUID, p_contact_days_before INTEGER DEFAULT 45)
RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE
  policy_record RECORD;
  termination_date DATE;
  competitor_renewal DATE;
  new_winback_date DATE;
  today DATE := CURRENT_DATE;
  count INTEGER := 0;
BEGIN
  FOR policy_record IN 
    SELECT id, termination_effective_date, policy_term_months 
    FROM winback_policies 
    WHERE agency_id = p_agency_id
  LOOP
    termination_date := policy_record.termination_effective_date;
    
    -- Start with first competitor renewal
    competitor_renewal := termination_date + (policy_record.policy_term_months || ' months')::INTERVAL;
    
    -- Keep adding terms until we're in the future
    WHILE competitor_renewal <= today LOOP
      competitor_renewal := competitor_renewal + (policy_record.policy_term_months || ' months')::INTERVAL;
    END LOOP;
    
    -- Win-back date is X days before renewal
    new_winback_date := competitor_renewal - (p_contact_days_before || ' days')::INTERVAL;
    
    -- Update the policy
    UPDATE winback_policies 
    SET calculated_winback_date = new_winback_date
    WHERE id = policy_record.id;
    
    count := count + 1;
  END LOOP;
  
  -- Recalculate all household aggregates for this agency
  UPDATE winback_households h
  SET earliest_winback_date = (
    SELECT MIN(calculated_winback_date) 
    FROM winback_policies p 
    WHERE p.household_id = h.id AND NOT p.is_cancel_rewrite
  )
  WHERE h.agency_id = p_agency_id;
  
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
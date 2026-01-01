-- Add DELETE policies for Cancel Audit, Renewals, and Explorer tables

-- Cancel Audit Records DELETE
CREATE POLICY "Users can delete their agency cancel audit records"
ON cancel_audit_records FOR DELETE
USING (has_cancel_audit_access(agency_id));

-- Cancel Audit Activities DELETE
CREATE POLICY "Users can delete their agency cancel audit activities"
ON cancel_audit_activities FOR DELETE
USING (has_cancel_audit_access(agency_id));

-- Cancel Audit Uploads DELETE
CREATE POLICY "Users can delete their agency cancel audit uploads"
ON cancel_audit_uploads FOR DELETE
USING (has_cancel_audit_access(agency_id));

-- Renewal Records DELETE
CREATE POLICY "Users can delete their agency renewal records"
ON renewal_records FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));

-- Renewal Activities DELETE
CREATE POLICY "Users can delete their agency renewal activities"
ON renewal_activities FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));

-- Renewal Uploads DELETE
CREATE POLICY "Users can delete their agency renewal uploads"
ON renewal_uploads FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));

-- Quoted Household Details (Prospects) DELETE
CREATE POLICY "Users can delete their agency prospects"
ON quoted_household_details FOR DELETE
USING (has_agency_access(auth.uid(), agency_id));

-- Sold Policy Details (Customers) DELETE - via quoted_household_detail
CREATE POLICY "Users can delete their agency customers"
ON sold_policy_details FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM quoted_household_details qhd
    WHERE qhd.id = sold_policy_details.quoted_household_detail_id
    AND has_agency_access(auth.uid(), qhd.agency_id)
  )
  OR EXISTS (
    SELECT 1 FROM submissions s
    JOIN form_templates ft ON ft.id = s.form_template_id
    WHERE s.id = sold_policy_details.submission_id
    AND has_agency_access(auth.uid(), ft.agency_id)
  )
);
-- Add 'call_efficiency' to the report_type check constraint
ALTER TABLE saved_reports DROP CONSTRAINT IF EXISTS saved_reports_report_type_check;
ALTER TABLE saved_reports ADD CONSTRAINT saved_reports_report_type_check 
  CHECK (report_type IN ('staff_roi', 'vendor_verifier', 'data_lead', 'mailer', 'live_transfer', 'call_efficiency'));
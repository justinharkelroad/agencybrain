-- Cleanup all cancel audit and renewal data for admin agency (979e8713-c266-4b23-96a9-fabd34f1fc9e)
DELETE FROM cancel_audit_activities WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
DELETE FROM cancel_audit_records WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
DELETE FROM cancel_audit_uploads WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
DELETE FROM renewal_activities WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
DELETE FROM renewal_records WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
DELETE FROM renewal_uploads WHERE agency_id = '979e8713-c266-4b23-96a9-fabd34f1fc9e';
-- Delete all renewal data for Ebersole Insurance (agency_id: 907b314c-e3b8-4cc1-956d-aa82ca2c016b)

-- Delete activities first (foreign key to records)
DELETE FROM renewal_activities WHERE agency_id = '907b314c-e3b8-4cc1-956d-aa82ca2c016b';

-- Delete records
DELETE FROM renewal_records WHERE agency_id = '907b314c-e3b8-4cc1-956d-aa82ca2c016b';

-- Delete uploads
DELETE FROM renewal_uploads WHERE agency_id = '907b314c-e3b8-4cc1-956d-aa82ca2c016b';
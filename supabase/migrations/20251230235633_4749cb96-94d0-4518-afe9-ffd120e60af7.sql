-- Delete cancel audit data for Moore Agency (accidental upload cleanup)
DELETE FROM cancel_audit_activities WHERE agency_id = '43ff5338-2663-44ff-ad2a-383ac203a301';
DELETE FROM cancel_audit_records WHERE agency_id = '43ff5338-2663-44ff-ad2a-383ac203a301';
DELETE FROM cancel_audit_uploads WHERE agency_id = '43ff5338-2663-44ff-ad2a-383ac203a301';
-- Fix security warnings: Set search_path for new functions
ALTER FUNCTION compute_is_late(uuid, jsonb, date, date, timestamptz) 
SECURITY DEFINER SET search_path = '';

ALTER FUNCTION get_agency_dates_now(uuid) 
SECURITY DEFINER SET search_path = '';

ALTER FUNCTION is_now_agency_time(uuid, text) 
SECURITY DEFINER SET search_path = '';
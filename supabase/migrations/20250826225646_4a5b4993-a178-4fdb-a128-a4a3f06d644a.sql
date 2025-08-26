-- Fix critical unique constraint issue on targets table
-- This ensures only one target per agency/member/metric combination
-- Handles NULL team_member_id (global defaults) properly

ALTER TABLE public.targets 
ADD CONSTRAINT targets_unique_constraint 
UNIQUE (agency_id, team_member_id, metric_key);
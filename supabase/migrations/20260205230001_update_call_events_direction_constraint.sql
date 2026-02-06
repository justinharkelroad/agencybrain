-- Allow lowercase direction values from RingCentral report ingest
-- while maintaining backward compatibility with existing Inbound/Outbound values

ALTER TABLE call_events DROP CONSTRAINT IF EXISTS call_events_direction_check;
ALTER TABLE call_events ADD CONSTRAINT call_events_direction_check
  CHECK (direction IN ('Inbound', 'Outbound', 'inbound', 'outbound'));

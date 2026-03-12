-- Add 'task_scheduled' to activity_type CHECK constraints
-- Required for the new "Schedule Task" feature in cancel audit, renewal, and winback modules.
-- Without this, inserts with activity_type = 'task_scheduled' would fail on the CHECK constraint.

-- Cancel audit activities: add 'task_scheduled' to allowed values
-- Original CHECK was defined inline (auto-named by PostgreSQL).
-- Use dynamic SQL to find and drop the actual constraint name safely.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'cancel_audit_activities'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%activity_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE cancel_audit_activities DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE cancel_audit_activities ADD CONSTRAINT cancel_audit_activities_activity_type_check
CHECK (activity_type IN (
  'attempted_call', 'voicemail_left', 'text_sent', 'email_sent',
  'spoke_with_client', 'payment_made', 'payment_promised', 'note',
  'task_scheduled'
));

-- Renewal activities: add 'task_scheduled' to allowed values
ALTER TABLE renewal_activities DROP CONSTRAINT IF EXISTS renewal_activities_activity_type_check;
ALTER TABLE renewal_activities ADD CONSTRAINT renewal_activities_activity_type_check
CHECK (activity_type IN ('phone_call', 'appointment', 'email', 'note', 'status_change', 'call', 'voicemail', 'text', 'review_done', 'task_scheduled'));

-- Winback activities: add 'task_scheduled' to allowed values
DO $$
BEGIN
  IF to_regclass('public.winback_activities') IS NOT NULL THEN
    ALTER TABLE winback_activities
    DROP CONSTRAINT IF EXISTS winback_activities_activity_type_check;

    ALTER TABLE winback_activities
    ADD CONSTRAINT winback_activities_activity_type_check
    CHECK (activity_type = ANY (ARRAY[
      'called'::text,
      'left_vm'::text,
      'texted'::text,
      'emailed'::text,
      'quoted'::text,
      'note'::text,
      'status_change'::text,
      'won_back'::text,
      'task_scheduled'::text
    ]));
  END IF;
END $$;

-- Debug the timezone calculation step by step
DO $$
DECLARE
  tz text;
  base_date date;
  due_ts timestamptz;
  submitted_ts timestamptz;
  result boolean;
BEGIN
  -- Get agency timezone
  SELECT timezone INTO tz FROM agencies WHERE id = '3c58f6f6-99cd-4c7d-97bc-3b16310ed4ba';
  RAISE NOTICE 'Agency timezone: %', tz;
  
  -- Set parameters
  base_date := '2025-09-05'::date;
  submitted_ts := '2025-09-06 01:28:22.331413+00'::timestamptz;  -- Jane's submission time
  
  RAISE NOTICE 'Base date: %', base_date;
  RAISE NOTICE 'Submitted at (UTC): %', submitted_ts;
  RAISE NOTICE 'Submitted at (Eastern): %', submitted_ts AT TIME ZONE 'America/New_York';
  
  -- Calculate due timestamp (should be Sept 5, 11:59 PM Eastern)
  due_ts := (base_date::text || ' 23:59')::timestamp AT TIME ZONE tz;
  
  RAISE NOTICE 'Due timestamp (UTC): %', due_ts;
  RAISE NOTICE 'Due timestamp (Eastern): %', due_ts AT TIME ZONE 'America/New_York';
  
  -- Compare
  result := submitted_ts > due_ts;
  RAISE NOTICE 'Is late? % (submitted: % > due: %)', result, submitted_ts, due_ts;
END $$;
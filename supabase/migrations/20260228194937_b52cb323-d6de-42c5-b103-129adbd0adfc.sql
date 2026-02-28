-- Fix NULL end_date on subscription 2602019500 (monthly, created Feb 1)
UPDATE subscriptions 
SET end_date = '2026-03-01T15:09:55+00',
    raw_data = jsonb_set(
      COALESCE(raw_data::jsonb, '{}'::jsonb), 
      '{due_date}', 
      '"2026-03-01T15:09:55.000000Z"'
    )
WHERE name = '2602019500' AND type = 'proxybr' AND end_date IS NULL;
-- Fix 2511284139: renewed today, should expire in ~30 days
UPDATE subscriptions 
SET end_date = '2026-03-28T16:52:37+00',
    raw_data = jsonb_set(
      raw_data::jsonb, 
      '{due_date}', 
      '"2026-03-28T16:52:37.000000Z"'
    )
WHERE name = '2511284139' AND type = 'proxybr';

-- Fix 2602019500: created Feb 1, monthly, should expire ~Mar 1
UPDATE subscriptions 
SET end_date = '2026-03-01T15:09:55+00',
    raw_data = jsonb_set(
      raw_data::jsonb, 
      '{due_date}', 
      '"2026-03-01T15:09:55.000000Z"'
    )
WHERE name = '2602019500' AND type = 'proxybr';
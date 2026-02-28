-- Fix all 3 active Radir subs to 30 days from today (2026-02-28)

-- 2511284139: 30 days from now
UPDATE subscriptions 
SET end_date = '2026-03-30T13:52:00+00',
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{due_date}', '"2026-03-30T13:52:00.000000Z"')
WHERE name = '2511284139' AND type = 'proxybr';

-- 2601288752: 30 days from now
UPDATE subscriptions 
SET end_date = '2026-03-30T12:28:00+00',
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{due_date}', '"2026-03-30T12:28:00.000000Z"')
WHERE name = '2601288752' AND type = 'proxybr';

-- 2602019500: 30 days from now
UPDATE subscriptions 
SET end_date = '2026-03-30T12:09:00+00',
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{due_date}', '"2026-03-30T12:09:00.000000Z"')
WHERE name = '2602019500' AND type = 'proxybr';
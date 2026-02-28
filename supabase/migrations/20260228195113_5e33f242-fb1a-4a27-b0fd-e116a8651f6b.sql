-- Fix end_dates to match ProxyBR panel exactly

-- 2511284139: created 28/11/2025, due 29/05/2026
UPDATE subscriptions 
SET end_date = '2026-05-29T13:52:00+00',
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{due_date}', '"2026-05-29T13:52:00.000000Z"')
WHERE name = '2511284139' AND type = 'proxybr';

-- 2601288752: created 28/01/2026, due 29/03/2026
UPDATE subscriptions 
SET end_date = '2026-03-29T12:28:00+00',
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{due_date}', '"2026-03-29T12:28:00.000000Z"')
WHERE name = '2601288752' AND type = 'proxybr';

-- 2602019500: created 01/02/2026, due 29/09/2026
UPDATE subscriptions 
SET end_date = '2026-09-29T12:09:00+00',
    raw_data = jsonb_set(COALESCE(raw_data::jsonb, '{}'::jsonb), '{due_date}', '"2026-09-29T12:09:00.000000Z"')
WHERE name = '2602019500' AND type = 'proxybr';
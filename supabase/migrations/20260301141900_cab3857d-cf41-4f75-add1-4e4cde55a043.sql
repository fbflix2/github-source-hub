UPDATE subscriptions 
SET raw_data = jsonb_set(raw_data::jsonb, '{exchange_quota_free}', '2')
WHERE name = '2602263003' AND type = 'proxybr';
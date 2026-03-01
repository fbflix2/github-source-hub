UPDATE subscriptions 
SET raw_data = jsonb_set(raw_data, '{exchange_quota_free}', '1'::jsonb),
updated_at = now()
WHERE name = '2602263003' AND type = 'proxybr'
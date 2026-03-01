UPDATE subscriptions 
SET raw_data = jsonb_set(raw_data, '{exchange_quota_free}', '2'::jsonb),
    updated_at = now()
WHERE type = 'proxybr' 
  AND status = 'active'
  AND (raw_data->>'exchange_quota_free')::int = 3
  AND user_id = (SELECT user_id FROM subscriptions WHERE name = '2602268604' AND type = 'proxybr');
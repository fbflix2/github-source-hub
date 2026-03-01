UPDATE subscriptions 
SET raw_data = jsonb_set(raw_data, '{exchange_quota_free}', to_jsonb((COALESCE((raw_data->>'exchange_quota_free')::int, 0) + 2))),
    updated_at = now()
WHERE type = 'proxybr' 
  AND status = 'active'
  AND name != '2602263003'
  AND user_id = (SELECT user_id FROM subscriptions WHERE name = '2602268604' AND type = 'proxybr');
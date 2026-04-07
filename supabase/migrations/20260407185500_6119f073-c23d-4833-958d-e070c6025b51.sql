
-- Revert Cimary's subscription back to ProxyBR original proxy
UPDATE subscriptions
SET 
  type = 'proxybr',
  auto_renew = true,
  raw_data = jsonb_build_object(
    'city_name', 'São Paulo',
    'country_code', 'BR',
    'exchange_quota_free', 2,
    'exchange_quota_pay', 10,
    'migrated_from', 'proxybr',
    'original_name', '2411085628',
    'provider', 'proxybr',
    'proxy_address', '45.179.90.115',
    'port', 27725,
    'username', 'r4DA8FNS',
    'password', 'rYnxcZLj',
    'original_raw_data', (raw_data->'original_raw_data')::jsonb
  ),
  updated_at = now()
WHERE id = 'be58d1e4-ed50-4114-946c-cac39acf5dc6';

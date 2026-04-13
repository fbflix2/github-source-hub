-- Revert 2504072638 back to only 1 proxy
UPDATE subscriptions
SET raw_data = jsonb_set(
  jsonb_set(
    raw_data,
    '{original_raw_data,proxies,data}',
    '[{"code":"45.179.90.106:34120:s0auXtPh:gIAsLXJs","id":508188,"notes":null,"status":"USED"}]'::jsonb
  ),
  '{original_raw_data,proxies,total}',
  '1'::jsonb
)
WHERE id = '8d2973c9-d90f-42b7-ba4d-1305df35c259';

-- Create new separate subscription for proxy 185.14.238.7:7760
INSERT INTO subscriptions (
  name, user_id, product_id, type, status, start_date, end_date, auto_renew, raw_data
) VALUES (
  'WS-IPV6-TPEN02',
  '039d50d7-4786-44fb-9181-64aa4480f855',
  'b20984f8-16fe-48d7-8c96-640da7f8e001',
  'webshare',
  'active',
  '2026-04-12 19:01:21.755+00',
  '2026-05-12 19:01:21.755+00',
  true,
  '{
    "proxy_address": "185.14.238.7",
    "port": 7760,
    "username": "s0auXtPh",
    "password": "gIAsLXJs",
    "city_name": "São Paulo",
    "country_code": "BR",
    "provider": "webshare",
    "migrated_from": "proxybr",
    "original_name": "2504072638",
    "profile_tag": "Tine Pen",
    "webshare_proxy_id": "legacy-ipv6-7760",
    "exchange_quota_free": 2,
    "exchange_quota_pay": 0
  }'::jsonb
);
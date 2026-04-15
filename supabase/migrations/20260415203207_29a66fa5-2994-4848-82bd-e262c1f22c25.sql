
-- Reactivate the original subscription with credentials from the two allocated proxies
UPDATE public.subscriptions 
SET 
  status = 'active',
  type = 'webshare',
  start_date = now(),
  end_date = now() + interval '30 days',
  raw_data = jsonb_build_object(
    'provider', 'webshare',
    'admin_allocated', true,
    'migrated_from_proxybr', true,
    'proxy_address', '108.165.53.104',
    'port', 6843,
    'username', 'fhvaccdh',
    'password', '19ao11w7oapk',
    'city_name', 'Fortaleza',
    'country_code', 'BR',
    'webshare_proxy_id', 'd-17376051771',
    'exchange_quota_free', 2,
    'exchange_quota_pay', 0,
    'proxy2_address', '92.112.175.25',
    'proxy2_port', 6298,
    'proxy2_username', 'fhvaccdh',
    'proxy2_password', '19ao11w7oapk',
    'proxy2_city_name', 'São Paulo',
    'proxy2_country_code', 'BR',
    'proxy2_webshare_proxy_id', 'd-17333416360'
  )
WHERE id = '9d9d271f-00a8-4bf6-8ea6-61df4087ef1f';

-- Cancel the two temporary subscriptions (data already migrated)
UPDATE public.subscriptions 
SET status = 'cancelled', cancelled_at = now()
WHERE id IN ('eebc51b0-b859-488d-9480-efe034f45d90', '360b0b6d-1d6a-49f8-bede-1ae061f5c608');

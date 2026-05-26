-- Final correction of metadata to ensure all proxies are visible in the UI
-- User ID: 20a4bc36-bcd4-477d-89f5-b347b678417c

-- Manual Delivery 1 (Contingency)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-1';

-- Manual Delivery 2 (Contingency)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-2';

-- Manual Delivery 3 (Contingency)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-3';

-- Manual Delivery 4 (Contingency)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-4';

-- Manual Delivery 5 (Ultra IPv6)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-5';

-- Manual Delivery 6 (Ultra IPv6)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-6';

-- Manual Delivery 7 (Ultra IPv6)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-7';

-- Manual Delivery 8 (Ultra IPv6)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-8';

-- Manual Delivery 9 (Web Scraping)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-9';

-- Manual Delivery 10 (Ultra IPv6 Extra)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-10';

-- Manual Delivery 11 (Ultra IPv6 Extra)
UPDATE public.subscriptions 
SET raw_data = raw_data || '{"country_code": "BR", "exchange_quota_free": 2, "exchange_quota_pay": 0}'::jsonb
WHERE name = 'WS-MANUAL-11';
